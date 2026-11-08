import { createStunOnlyRtcConfiguration } from './stunConfig';
import { signalingService } from './signaling';
import { cryptoService } from '../crypto';
import { chunkerService, type TransferProgressCallback } from './dataChannelChunker';
import { localDb } from '../db';
import { supabaseService } from '../supabase';
import type { 
  PeerConnectionStatus, 
  SignalingPayload, 
  WirePacket, 
  LocalMessage,
  ActiveCallState
} from '@/types';

// ============================================================================
// Core WebRTC Peer Connection & Media Manager
// STRICT ARCHITECTURAL PRINCIPLES:
// 1. Direct browser-to-browser communication only (WebRTC).
// 2. STUN only (Google STUN). Strictly NO TURN fallback.
// 3. Application-level AES-256-GCM encryption on RTCDataChannel.
// 4. Zero chat messages or media forwarded or stored on the server.
// ============================================================================

export type PeerStatusChangeHandler = (peerUserId: string, status: PeerConnectionStatus, errorReason?: string) => void;
export type MessageReceivedHandler = (message: LocalMessage) => void;
export type TypingChangeHandler = (peerUserId: string, isTyping: boolean) => void;
export type CallStateChangeHandler = (callState: ActiveCallState) => void;
export type RemoteStreamHandler = (peerUserId: string, stream: MediaStream) => void;

interface PeerSession {
  peerUserId: string;
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  status: PeerConnectionStatus;
  errorReason?: string;
  pendingCandidates: RTCIceCandidateInit[];
  sharedKey: CryptoKey | null;
  peerPublicKeyJWK: string | null;
  isInitiator: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

class PeerConnectionManager {
  private currentUserId: string | null = null;
  private currentUserName: string = 'Me';
  private peers: Map<string, PeerSession> = new Map();

  // Media Call State
  private localMediaStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private activeCall: ActiveCallState = {
    active: false,
    callType: 'voice',
    isIncoming: false,
    remoteUserId: '',
    remoteUserName: '',
    status: 'ended',
    isMuted: false,
    isVideoOff: false
  };

  // Event Listeners
  private statusListeners: Set<PeerStatusChangeHandler> = new Set();
  private messageListeners: Set<MessageReceivedHandler> = new Set();
  private typingListeners: Set<TypingChangeHandler> = new Set();
  private callListeners: Set<CallStateChangeHandler> = new Set();
  private streamListeners: Set<RemoteStreamHandler> = new Set();
  private fileProgressListeners: Map<string, TransferProgressCallback> = new Map();

  // Screen WakeLock & Screen Sharing
  private wakeLock: any = null;
  private isScreenSharing: boolean = false;

  /**
   * Initializes the manager with current user profile.
   */
  init(userId: string, displayName: string): void {
    this.currentUserId = userId;
    this.currentUserName = displayName;

    // Listen to incoming signaling broadcasts
    signalingService.onMessage(this.handleSignalingPayload.bind(this));

    // Setup auto-recovery on tab visibility change & network online
    this.setupRecoveryListeners();
  }

  private setupRecoveryListeners(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('[WebRTC] App visibility restored: recovering any stale connections');
          this.recoverStaleConnections();
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[WebRTC] Network online event: recovering peer links');
        this.recoverStaleConnections();
      });
    }
  }

  private recoverStaleConnections(): void {
    for (const [peerId, session] of this.peers.entries()) {
      if (session.status === 'failed' || session.status === 'disconnected') {
        console.log(`[WebRTC] Auto-reconnecting failed peer link: ${peerId}`);
        this.connectToPeer(peerId, session.peerPublicKeyJWK || undefined, true).catch(() => {});
      } else if (session.status === 'connected' && session.pc) {
        if (session.pc.iceConnectionState === 'disconnected' || session.pc.iceConnectionState === 'failed') {
          try {
            console.log(`[WebRTC] Restarting ICE for peer: ${peerId}`);
            session.pc.restartIce();
          } catch {
            this.connectToPeer(peerId, session.peerPublicKeyJWK || undefined, true).catch(() => {});
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Connection Establishment (1-to-1 P2P)
  // --------------------------------------------------------------------------
  /**
   * Connects to a peer over STUN-only WebRTC.
   * If already connected, returns existing session.
   */
  async connectToPeer(
    peerUserId: string, 
    peerPublicKeyJWK?: string, 
    forceRestart: boolean = false
  ): Promise<PeerSession> {
    const existing = this.peers.get(peerUserId);
    if (!forceRestart && existing) {
      if (existing.status === 'connected') {
        return existing;
      }
      if (existing.status === 'signaling' || existing.status === 'connecting') {
        console.log(`[WebRTC] Peer ${peerUserId} connection in progress ('${existing.status}'); awaiting handshake.`);
        return existing;
      }
    }

    if (existing) {
      this.closePeerSession(peerUserId);
    }

    // Join direct signaling room
    signalingService.joinDirectSignalingChannel(peerUserId);

    // Fetch peer public key for E2EE if not provided
    let pubKey = peerPublicKeyJWK;
    if (!pubKey) {
      pubKey = (await supabaseService.getPeerPublicKey(peerUserId)) || undefined;
    }

    // Deterministic initiator: Peer with lexicographically smaller ID initiates offer
    const isDesignatedInitiator = !this.currentUserId || this.currentUserId < peerUserId;

    if (!isDesignatedInitiator && !forceRestart) {
      // Receiver: Send connect-ping to let designated initiator create offer
      console.log(`[WebRTC] Sending connect-ping to designated initiator ${peerUserId}`);
      this.updateStatus(peerUserId, 'connecting');
      this.startConnectionWatchdog(peerUserId);

      await signalingService.sendSignal({
        type: 'connect-ping',
        senderId: this.currentUserId!,
        targetId: peerUserId,
        sessionId: 'ping_' + Date.now(),
        timestamp: Date.now()
      });

      const session = this.createPeerSession(peerUserId, false, pubKey);
      return session;
    }

    const session = this.createPeerSession(peerUserId, true, pubKey);

    // Create RTCDataChannel as initiator
    const dc = session.pc.createDataChannel('p2p-chat-e2ee', {
      ordered: true
    });
    this.setupDataChannel(peerUserId, dc);
    session.dataChannel = dc;

    // Create and send SDP Offer
    try {
      session.makingOffer = true;
      this.updateStatus(peerUserId, 'signaling');
      this.startConnectionWatchdog(peerUserId);
      const offer = await session.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await session.pc.setLocalDescription(offer);

      await signalingService.sendSignal({
        type: 'offer',
        senderId: this.currentUserId!,
        targetId: peerUserId,
        sessionId: 'sess_' + Date.now(),
        sdp: offer,
        timestamp: Date.now()
      });
    } catch (err: any) {
      console.error('[WebRTC] Error creating offer for peer:', peerUserId, err);
      this.updateStatus(peerUserId, 'failed', err.message);
    } finally {
      session.makingOffer = false;
    }

    return session;
  }

  private createPeerSession(
    peerUserId: string, 
    isInitiator: boolean, 
    peerPublicKeyJWK?: string
  ): PeerSession {
    const rtcConfig = createStunOnlyRtcConfiguration();
    const pc = new RTCPeerConnection(rtcConfig);

    const session: PeerSession = {
      peerUserId,
      pc,
      dataChannel: null,
      status: 'idle',
      pendingCandidates: [],
      sharedKey: null,
      peerPublicKeyJWK: peerPublicKeyJWK || null,
      isInitiator,
      makingOffer: false,
      ignoreOffer: false
    };

    this.peers.set(peerUserId, session);

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentUserId) {
        signalingService.sendSignal({
          type: 'ice-candidate',
          senderId: this.currentUserId,
          targetId: peerUserId,
          sessionId: 'sess_ice',
          candidate: event.candidate.toJSON(),
          timestamp: Date.now()
        }).catch(err => {
          console.warn('[WebRTC] ICE candidate signal delivery warning:', err);
        });
      }
    };

    // Connection state changes with automatic self-healing recovery
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] Peer ${peerUserId} connectionState: ${state}`);
      if (state === 'connected') {
        this.clearRecoveryTimeout(peerUserId);
        this.updateStatus(peerUserId, 'connected');
      } else if (state === 'connecting') {
        this.updateStatus(peerUserId, 'connecting');
      } else if (state === 'disconnected') {
        this.handleConnectionRecovery(peerUserId, false);
      } else if (state === 'failed') {
        this.handleConnectionRecovery(peerUserId, true);
      }
    };

    // ICE Connection State
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      console.log(`[WebRTC] Peer ${peerUserId} iceConnectionState: ${iceState}`);
      if (iceState === 'connected' || iceState === 'completed') {
        this.clearRecoveryTimeout(peerUserId);
        this.updateStatus(peerUserId, 'connected');
      } else if (iceState === 'disconnected') {
        this.handleConnectionRecovery(peerUserId, false);
      } else if (iceState === 'failed') {
        this.handleConnectionRecovery(peerUserId, true);
      }
    };

    // Incoming DataChannel (for receiver)
    pc.ondatachannel = (event) => {
      session.dataChannel = event.channel;
      this.setupDataChannel(peerUserId, event.channel);
    };

    // Incoming MediaStream Tracks (Voice & Video)
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Incoming media track from ${peerUserId}: ${event.track.kind}`);
      let stream = this.remoteStreams.get(peerUserId);
      if (!stream) {
        if (event.streams && event.streams[0]) {
          stream = event.streams[0];
        } else {
          stream = new MediaStream();
        }
        this.remoteStreams.set(peerUserId, stream);
      }

      if (!stream.getTracks().some(t => t.id === event.track.id)) {
        stream.addTrack(event.track);
      }

      for (const listener of this.streamListeners) {
        listener(peerUserId, stream);
      }
    };

    // Auto-renegotiation when media tracks are added/removed
    pc.onnegotiationneeded = async () => {
      if (session.status !== 'connected' && session.status !== 'signaling') return;
      try {
        console.log(`[WebRTC] Renegotiation needed for ${peerUserId}`);
        session.makingOffer = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        await signalingService.sendSignal({
          type: 'offer',
          senderId: this.currentUserId!,
          targetId: peerUserId,
          sessionId: 'reneg_' + Date.now(),
          sdp: offer,
          callType: this.activeCall.callType,
          timestamp: Date.now()
        });
      } catch (err) {
        console.warn('[WebRTC] Negotiation needed error:', err);
      } finally {
        session.makingOffer = false;
      }
    };

    // Attach local media stream tracks if in a call
    if (this.localMediaStream) {
      for (const track of this.localMediaStream.getTracks()) {
        pc.addTrack(track, this.localMediaStream);
      }
    }

    return session;
  }

  // --------------------------------------------------------------------------
  // DataChannel Wire Communication & Cryptography
  // --------------------------------------------------------------------------
  private setupDataChannel(peerUserId: string, channel: RTCDataChannel): void {
    channel.onopen = async () => {
      this.updateStatus(peerUserId, 'connected');

      // 1. Immediately exchange device public key in-band over the data channel
      try {
        const { publicKeyJWK } = await cryptoService.getOrCreateDeviceKeypair();
        const keyExchangePacket: WirePacket = {
          type: 'KEY_EXCHANGE',
          id: 'key_' + Date.now(),
          senderId: this.currentUserId!,
          timestamp: Date.now(),
          publicKeyJWK
        };
        channel.send(JSON.stringify(keyExchangePacket));
      } catch (err) {
        console.warn('Could not send initial in-band key exchange:', err);
      }

      // 2. Attempt to establish shared AES-256-GCM session key
      const session = this.peers.get(peerUserId);
      if (session) {
        if (!session.peerPublicKeyJWK) {
          session.peerPublicKeyJWK = (await supabaseService.getPeerPublicKey(peerUserId)) || null;
        }
        if (session.peerPublicKeyJWK) {
          try {
            session.sharedKey = await cryptoService.getOrDeriveSharedKey(peerUserId, session.peerPublicKeyJWK);
            console.log(`[WebRTC] Initial AES-256-GCM shared key established with ${peerUserId}`);
          } catch (e) {
            console.warn('Could not derive E2EE shared key for peer:', e);
          }
        }
      }

      // 3. Automatically flush any queued outbox messages
      await this.flushOutbox(peerUserId);
    };

    channel.onclose = () => {
      this.updateStatus(peerUserId, 'disconnected');
    };

    channel.onerror = (err) => {
      console.error('RTCDataChannel error with peer', peerUserId, err);
      this.updateStatus(peerUserId, 'failed', 'DataChannel error: ' + (err as any).message);
    };

    channel.onmessage = async (event) => {
      try {
        const packet = JSON.parse(event.data) as WirePacket;
        await this.handleIncomingPacket(peerUserId, packet);
      } catch (err) {
        console.error('Failed to parse incoming DataChannel packet:', err);
      }
    };
  }

  private async handleIncomingPacket(peerUserId: string, packet: WirePacket): Promise<void> {
    const session = this.peers.get(peerUserId);

    switch (packet.type) {
      case 'KEY_EXCHANGE': {
        if (packet.publicKeyJWK && session) {
          console.log(`[WebRTC] Received direct in-band public key from ${peerUserId}`);
          session.peerPublicKeyJWK = packet.publicKeyJWK;
          try {
            session.sharedKey = await cryptoService.deriveSharedKeyDirect(packet.publicKeyJWK);
            console.log(`[WebRTC] Re-derived in-band shared AES-256-GCM key for ${peerUserId}`);
          } catch (err) {
            console.warn('Failed to derive shared key from in-band key exchange:', err);
          }
        }
        break;
      }

      case 'CHAT_MESSAGE': {
        let textContent = '';
        let isE2EE = false;

        // In-band public key synchronization: if sender attached their public key, sync our shared key!
        if (packet.publicKeyJWK && session) {
          if (!session.sharedKey || session.peerPublicKeyJWK !== packet.publicKeyJWK) {
            session.peerPublicKeyJWK = packet.publicKeyJWK;
            try {
              session.sharedKey = await cryptoService.deriveSharedKeyDirect(packet.publicKeyJWK);
              console.log(`[WebRTC] Synced in-band shared key for ${peerUserId}`);
            } catch (err) {
              console.warn('Failed to sync in-band shared key:', err);
            }
          }
        }

        if (packet.ciphertext && packet.iv && session?.sharedKey) {
          try {
            textContent = await cryptoService.decryptText(
              { ciphertext: packet.ciphertext, iv: packet.iv },
              session.sharedKey
            );
            isE2EE = true;
          } catch (err) {
            console.error('Failed to decrypt incoming text with shared key:', err);
            // Fallback attempt with direct public key re-derivation if attached
            if (packet.publicKeyJWK) {
              try {
                const freshKey = await cryptoService.deriveSharedKeyDirect(packet.publicKeyJWK);
                textContent = await cryptoService.decryptText(
                  { ciphertext: packet.ciphertext, iv: packet.iv },
                  freshKey
                );
                session.sharedKey = freshKey;
                isE2EE = true;
              } catch (freshErr) {
                try {
                  textContent = atob(packet.ciphertext);
                } catch {
                  textContent = '[Decryption failed]';
                }
              }
            } else {
              try {
                textContent = atob(packet.ciphertext);
              } catch {
                textContent = '[Decryption failed]';
              }
            }
          }
        } else if (packet.ciphertext) {
          try {
            textContent = atob(packet.ciphertext);
          } catch {
            textContent = packet.ciphertext;
          }
        }

        const localMsg: LocalMessage = {
          id: packet.id,
          conversationId: peerUserId,
          senderId: peerUserId,
          senderName: 'Contact',
          type: 'text',
          content: textContent,
          status: 'delivered',
          timestamp: packet.timestamp,
          isE2EE
        };

        // Save directly to local IndexedDB (never sent to server!)
        await localDb.saveMessage(localMsg);

        // Send ACK back so sender gets delivery confirmation (double checkmark ✓✓)
        if (session?.dataChannel?.readyState === 'open') {
          session.dataChannel.send(JSON.stringify({
            type: 'MESSAGE_ACK',
            id: 'ack_' + packet.id,
            senderId: this.currentUserId!,
            ackMessageId: packet.id,
            timestamp: Date.now()
          }));
        }

        // Notify UI listeners
        for (const listener of this.messageListeners) {
          listener(localMsg);
        }
        break;
      }

      case 'MESSAGE_ACK': {
        const ackId = packet.ackMessageId || (packet.id?.startsWith('ack_') ? packet.id.substring(4) : packet.id);
        if (ackId) {
          await localDb.updateMessageStatus(ackId, 'delivered');
          const msg = await localDb.messages.get(ackId);
          if (msg) {
            for (const listener of this.messageListeners) {
              listener({ ...msg, status: 'delivered' });
            }
          }
        }
        break;
      }

      case 'TYPING': {
        for (const listener of this.typingListeners) {
          listener(peerUserId, Boolean(packet.isTyping));
        }
        break;
      }

      case 'FILE_START': {
        if (packet.fileMeta) {
          chunkerService.initIncomingTransfer(packet.fileMeta);
        }
        break;
      }

      case 'FILE_CHUNK': {
        if (packet.chunkMeta && packet.id) {
          let rawChunk: ArrayBuffer;
          if (packet.ciphertext && packet.iv && session?.sharedKey) {
            rawChunk = await cryptoService.decryptBinaryChunk(
              { ciphertext: packet.ciphertext, iv: packet.iv },
              session.sharedKey
            );
          } else if (packet.ciphertext) {
            // Base64 decode
            const binary = atob(packet.ciphertext);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            rawChunk = bytes.buffer;
          } else {
            return;
          }

          const progressCallback = this.fileProgressListeners.get(packet.id);
          chunkerService.handleIncomingChunk(
            packet.id,
            packet.chunkMeta.chunkIndex,
            rawChunk,
            progressCallback
          );
        }
        break;
      }

      case 'FILE_END': {
        if (packet.id) {
          const finalFile = chunkerService.finalizeIncomingTransfer(packet.id);
          if (finalFile) {
            const blobUrl = URL.createObjectURL(finalFile.blob);
            const localFileMsg: LocalMessage = {
              id: packet.id,
              conversationId: peerUserId,
              senderId: peerUserId,
              senderName: 'Contact',
              type: 'file',
              content: finalFile.name,
              fileMetadata: {
                id: packet.id,
                name: finalFile.name,
                size: finalFile.blob.size,
                mimeType: finalFile.mimeType,
                dataBlob: finalFile.blob,
                blobUrl
              },
              status: 'delivered',
              timestamp: packet.timestamp,
              isE2EE: Boolean(session?.sharedKey)
            };

            await localDb.saveMessage(localFileMsg);

            for (const listener of this.messageListeners) {
              listener(localFileMsg);
            }
          }
        }
        break;
      }

      case 'FILE_CANCEL': {
        if (packet.id) {
          chunkerService.cancelTransfer(packet.id);
        }
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Message & File Sending API
  // --------------------------------------------------------------------------
  /**
   * Sends a direct encrypted chat message to a peer over RTCDataChannel.
   */
  async sendMessage(peerUserId: string, content: string): Promise<LocalMessage> {
    const session = await this.ensureConnectedSession(peerUserId);

    // If channel is not currently open, queue in local IndexedDB outbox
    if (!session.dataChannel || session.dataChannel.readyState !== 'open') {
      const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const queuedMsg: LocalMessage = {
        id: messageId,
        conversationId: peerUserId,
        senderId: this.currentUserId!,
        senderName: this.currentUserName,
        type: 'text',
        content,
        status: 'queued',
        timestamp: Date.now(),
        isE2EE: true
      };

      await localDb.saveMessage(queuedMsg);

      // Trigger connection if not already in progress
      if (session.status !== 'connecting' && session.status !== 'signaling') {
        this.connectToPeer(peerUserId).catch(() => {});
      }

      return queuedMsg;
    }

    const { publicKeyJWK } = await cryptoService.getOrCreateDeviceKeypair();

    // Ensure session has peer public key and shared key
    if (!session.sharedKey) {
      if (!session.peerPublicKeyJWK) {
        session.peerPublicKeyJWK = (await supabaseService.getPeerPublicKey(peerUserId)) || null;
      }
      if (session.peerPublicKeyJWK) {
        try {
          session.sharedKey = await cryptoService.getOrDeriveSharedKey(peerUserId, session.peerPublicKeyJWK);
        } catch (e) {
          console.warn('Could not derive key before send:', e);
        }
      }
    }

    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    let ciphertext = '';
    let iv = '';
    let isE2EE = false;

    // Encrypt with AES-256-GCM if sharedKey available
    if (session.sharedKey) {
      const encrypted = await cryptoService.encryptText(content, session.sharedKey);
      ciphertext = encrypted.ciphertext;
      iv = encrypted.iv;
      isE2EE = true;
    } else {
      ciphertext = btoa(content);
    }

    const packet: WirePacket = {
      type: 'CHAT_MESSAGE',
      id: messageId,
      senderId: this.currentUserId!,
      timestamp: Date.now(),
      ciphertext,
      iv: iv || undefined,
      publicKeyJWK
    };

    session.dataChannel.send(JSON.stringify(packet));

    const localMsg: LocalMessage = {
      id: messageId,
      conversationId: peerUserId,
      senderId: this.currentUserId!,
      senderName: this.currentUserName,
      type: 'text',
      content,
      status: 'sent',
      timestamp: packet.timestamp,
      isE2EE
    };

    await localDb.saveMessage(localMsg);
    return localMsg;
  }

  /**
   * Flushes any messages queued in IndexedDB outbox when DataChannel opens.
   */
  async flushOutbox(peerUserId: string): Promise<void> {
    const session = this.peers.get(peerUserId);
    if (!session?.dataChannel || session.dataChannel.readyState !== 'open') return;

    try {
      const queuedMessages = await localDb.getQueuedMessages(peerUserId);
      if (!queuedMessages || queuedMessages.length === 0) return;

      console.log(`[WebRTC Outbox] Flushing ${queuedMessages.length} pending message(s) to ${peerUserId}`);
      const { publicKeyJWK } = await cryptoService.getOrCreateDeviceKeypair();

      for (const msg of queuedMessages) {
        let ciphertext = '';
        let iv = '';
        let isE2EE = false;

        if (session.sharedKey) {
          const enc = await cryptoService.encryptText(msg.content, session.sharedKey);
          ciphertext = enc.ciphertext;
          iv = enc.iv;
          isE2EE = true;
        } else {
          ciphertext = btoa(msg.content);
        }

        const packet: WirePacket = {
          type: 'CHAT_MESSAGE',
          id: msg.id,
          senderId: this.currentUserId!,
          timestamp: msg.timestamp,
          ciphertext,
          iv: iv || undefined,
          publicKeyJWK
        };

        session.dataChannel.send(JSON.stringify(packet));
        await localDb.updateMessageStatus(msg.id, 'sent');
        msg.status = 'sent';
        msg.isE2EE = isE2EE;

        for (const listener of this.messageListeners) {
          listener(msg);
        }
      }
    } catch (err) {
      console.warn(`[WebRTC Outbox] Error flushing outbox for ${peerUserId}:`, err);
    }
  }

  /**
   * Sends a file/image/video directly over RTCDataChannel in encrypted chunks.
   */
  async sendFile(
    peerUserId: string,
    file: File,
    onProgress?: TransferProgressCallback
  ): Promise<LocalMessage> {
    const session = await this.ensureConnectedSession(peerUserId);

    if (!session.dataChannel || session.dataChannel.readyState !== 'open') {
      throw new Error('Direct P2P DataChannel is not open for file transfer');
    }

    const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    if (onProgress) {
      this.fileProgressListeners.set(fileId, onProgress);
    }

    const encryptFn = session.sharedKey
      ? (chunk: ArrayBuffer) => cryptoService.encryptBinaryChunk(chunk, session.sharedKey!)
      : undefined;

    // Direct chunked transfer
    await chunkerService.sendFile(
      file,
      { fileId, fileName: file.name, mimeType: file.type },
      session.dataChannel,
      encryptFn,
      onProgress
    );

    this.fileProgressListeners.delete(fileId);

    const blobUrl = URL.createObjectURL(file);
    const localFileMsg: LocalMessage = {
      id: fileId,
      conversationId: peerUserId,
      senderId: this.currentUserId!,
      senderName: this.currentUserName,
      type: 'file',
      content: file.name,
      fileMetadata: {
        id: fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        dataBlob: file,
        blobUrl
      },
      status: 'sent',
      timestamp: Date.now(),
      isE2EE: Boolean(session.sharedKey)
    };

    await localDb.saveMessage(localFileMsg);
    return localFileMsg;
  }

  sendTypingIndicator(peerUserId: string, isTyping: boolean): void {
    const session = this.peers.get(peerUserId);
    if (session?.dataChannel?.readyState === 'open') {
      const packet: WirePacket = {
        type: 'TYPING',
        id: 'typing_' + Date.now(),
        senderId: this.currentUserId!,
        timestamp: Date.now(),
        isTyping
      };
      session.dataChannel.send(JSON.stringify(packet));
    }
  }

  // --------------------------------------------------------------------------
  // Voice & Video Calling (WebRTC MediaStream)
  // --------------------------------------------------------------------------
  private async acquireUserMedia(callType: 'voice' | 'video'): Promise<MediaStream> {
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };

    if (callType === 'voice') {
      return await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false
      });
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: {
          facingMode: 'user',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        }
      });
    } catch (err) {
      console.warn('[WebRTC] Preferred HD video constraints failed, using fallback:', err);
      return await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: true
      });
    }
  }

  async startCall(
    peerUserId: string, 
    callType: 'voice' | 'video',
    peerDisplayName: string
  ): Promise<void> {
    // 1. Acquire local media with echo cancellation and auto-gain
    this.localMediaStream = await this.acquireUserMedia(callType);
    await this.acquireWakeLock();

    this.activeCall = {
      active: true,
      callType,
      isIncoming: false,
      remoteUserId: peerUserId,
      remoteUserName: peerDisplayName,
      status: 'ringing',
      isMuted: false,
      isVideoOff: false,
      startedAt: Date.now()
    };
    this.notifyCallStateChange();

    // 2. Connect or attach tracks to peer connection
    let session = this.peers.get(peerUserId);
    if (!session || session.status === 'failed' || session.status === 'disconnected') {
      session = await this.connectToPeer(peerUserId);
    }

    if (session && this.localMediaStream) {
      const senders = session.pc.getSenders();
      for (const track of this.localMediaStream.getTracks()) {
        const alreadyAdded = senders.some(s => s.track?.id === track.id || s.track?.kind === track.kind);
        if (!alreadyAdded) {
          session.pc.addTrack(track, this.localMediaStream);
        } else {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) sender.replaceTrack(track).catch(console.warn);
        }
      }
    }

    // 3. Send call invitation signal (DO NOT create offer yet; wait for receiver acceptance to prevent glare)
    await signalingService.sendSignal({
      type: 'call-invite',
      senderId: this.currentUserId!,
      targetId: peerUserId,
      sessionId: 'call_' + Date.now(),
      callType,
      timestamp: Date.now()
    });
  }

  async acceptCall(callType?: 'voice' | 'video'): Promise<void> {
    if (!this.activeCall.active || !this.activeCall.remoteUserId) return;

    const actualType = callType || this.activeCall.callType;
    const remoteId = this.activeCall.remoteUserId;

    // 1. Acquire local media with fallback
    try {
      this.localMediaStream = await this.acquireUserMedia(actualType);
      await this.acquireWakeLock();
    } catch (err: any) {
      console.error('Media permission denied:', err);
      this.rejectCall();
      throw new Error('Camera/Microphone permission denied: ' + err.message);
    }

    this.activeCall.status = 'connected';
    this.activeCall.startedAt = Date.now();
    this.notifyCallStateChange();

    // 2. Attach tracks to peer connection
    let session = this.peers.get(remoteId);
    if (!session || session.status === 'failed' || session.status === 'disconnected') {
      session = await this.connectToPeer(remoteId);
    }

    if (session && this.localMediaStream) {
      const senders = session.pc.getSenders();
      for (const track of this.localMediaStream.getTracks()) {
        const alreadyAdded = senders.some(s => s.track?.id === track.id || s.track?.kind === track.kind);
        if (!alreadyAdded) {
          session.pc.addTrack(track, this.localMediaStream);
        } else {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) sender.replaceTrack(track).catch(console.warn);
        }
      }
    }

    // 3. Send acceptance signal (Caller will create the clean renegotiation offer)
    await signalingService.sendSignal({
      type: 'call-accept',
      senderId: this.currentUserId!,
      targetId: remoteId,
      sessionId: 'call_' + Date.now(),
      callType: actualType,
      timestamp: Date.now()
    });
  }

  async rejectCall(): Promise<void> {
    if (this.activeCall.active && this.activeCall.remoteUserId) {
      await signalingService.sendSignal({
        type: 'call-reject',
        senderId: this.currentUserId!,
        targetId: this.activeCall.remoteUserId,
        sessionId: 'call_reject',
        timestamp: Date.now()
      });
    }
    this.endCall();
  }

  endCall(): void {
    if (this.activeCall.active && this.activeCall.remoteUserId) {
      signalingService.sendSignal({
        type: 'call-end',
        senderId: this.currentUserId!,
        targetId: this.activeCall.remoteUserId,
        sessionId: 'call_end',
        timestamp: Date.now()
      }).catch(console.error);

      // Record call log in local storage
      const durationSeconds = this.activeCall.startedAt 
        ? Math.round((Date.now() - this.activeCall.startedAt) / 1000) 
        : 0;

      const callLogMsg: LocalMessage = {
        id: 'call_' + Date.now(),
        conversationId: this.activeCall.remoteUserId,
        senderId: this.currentUserId!,
        senderName: this.currentUserName,
        type: 'call_log',
        content: `${this.activeCall.callType === 'video' ? 'Video' : 'Voice'} Call (${durationSeconds}s)`,
        callMetadata: {
          callType: this.activeCall.callType,
          status: this.activeCall.status === 'connected' ? 'completed' : 'missed',
          durationSeconds
        },
        status: 'sent',
        timestamp: Date.now(),
        isE2EE: true
      };
      localDb.saveMessage(callLogMsg).catch(console.error);
    }

    // Stop local media tracks
    if (this.localMediaStream) {
      for (const track of this.localMediaStream.getTracks()) {
        track.stop();
      }
      this.localMediaStream = null;
    }

    this.releaseWakeLock();
    this.isScreenSharing = false;

    this.remoteStreams.clear();
    this.activeCall = {
      active: false,
      callType: 'voice',
      isIncoming: false,
      remoteUserId: '',
      remoteUserName: '',
      status: 'ended',
      isMuted: false,
      isVideoOff: false
    };

    this.notifyCallStateChange();
  }

  toggleMute(): boolean {
    if (!this.localMediaStream) return false;
    const audioTrack = this.localMediaStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.activeCall.isMuted = !audioTrack.enabled;
      this.notifyCallStateChange();
      return this.activeCall.isMuted;
    }
    return false;
  }

  toggleVideo(): boolean {
    if (!this.localMediaStream) return false;
    const videoTrack = this.localMediaStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.activeCall.isVideoOff = !videoTrack.enabled;
      this.notifyCallStateChange();
      return this.activeCall.isVideoOff;
    }
    return false;
  }

  private async acquireWakeLock(): Promise<void> {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('[WebRTC Call] Screen WakeLock acquired successfully');
      } catch (err) {
        console.warn('[WebRTC Call] Screen WakeLock request rejected:', err);
      }
    }
  }

  private releaseWakeLock(): void {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
        console.log('[WebRTC Call] Screen WakeLock released');
      } catch (err) {
        console.warn('[WebRTC Call] Screen WakeLock release warning:', err);
      }
      this.wakeLock = null;
    }
  }

  async flipCamera(): Promise<boolean> {
    if (!this.localMediaStream || this.activeCall.callType !== 'video') return false;
    const currentVideoTrack = this.localMediaStream.getVideoTracks()[0];
    if (!currentVideoTrack) return false;

    const currentFacing = currentVideoTrack.getSettings().facingMode;
    const targetFacing = currentFacing === 'environment' ? 'user' : 'environment';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: targetFacing } }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return false;

      // Replace track on all active peer senders
      for (const session of this.peers.values()) {
        const senders = session.pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }

      currentVideoTrack.stop();
      this.localMediaStream.removeTrack(currentVideoTrack);
      this.localMediaStream.addTrack(newVideoTrack);
      this.notifyCallStateChange();
      return true;
    } catch (err) {
      console.warn('[Call] Camera flip error:', err);
      return false;
    }
  }

  async toggleScreenShare(): Promise<boolean> {
    if (!this.localMediaStream) return false;
    const currentVideoTrack = this.localMediaStream.getVideoTracks()[0];

    try {
      if (this.isScreenSharing) {
        // Revert to camera
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }
        });
        const camTrack = camStream.getVideoTracks()[0];
        for (const session of this.peers.values()) {
          const videoSender = session.pc.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender) await videoSender.replaceTrack(camTrack);
        }
        if (currentVideoTrack) {
          currentVideoTrack.stop();
          this.localMediaStream.removeTrack(currentVideoTrack);
        }
        this.localMediaStream.addTrack(camTrack);
        this.isScreenSharing = false;
      } else {
        // Start screen share
        if (!navigator.mediaDevices?.getDisplayMedia) return false;
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = displayStream.getVideoTracks()[0];

        screenTrack.onended = () => {
          this.toggleScreenShare().catch(console.warn);
        };

        for (const session of this.peers.values()) {
          const videoSender = session.pc.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender) await videoSender.replaceTrack(screenTrack);
        }

        if (currentVideoTrack) {
          currentVideoTrack.stop();
          this.localMediaStream.removeTrack(currentVideoTrack);
        }
        this.localMediaStream.addTrack(screenTrack);
        this.isScreenSharing = true;
      }

      this.notifyCallStateChange();
      return this.isScreenSharing;
    } catch (err) {
      console.warn('[Call] Screen share toggle error:', err);
      return false;
    }
  }

  async getConnectionType(peerUserId: string): Promise<'lan' | 'stun' | 'offline'> {
    const session = this.peers.get(peerUserId);
    if (!session || session.status !== 'connected' || !session.pc) return 'offline';

    try {
      const stats = await session.pc.getStats();
      let isHostPair = false;
      stats.forEach(report => {
        if (
          report.type === 'candidate-pair' &&
          (report.state === 'succeeded' || report.nominated)
        ) {
          const localCand = stats.get(report.localCandidateId);
          const remoteCand = stats.get(report.remoteCandidateId);
          if (localCand?.candidateType === 'host' && remoteCand?.candidateType === 'host') {
            isHostPair = true;
          }
        }
      });
      return isHostPair ? 'lan' : 'stun';
    } catch {
      return 'stun';
    }
  }

  getLocalMediaStream(): MediaStream | null {
    return this.localMediaStream;
  }

  getRemoteMediaStream(peerUserId: string): MediaStream | undefined {
    return this.remoteStreams.get(peerUserId);
  }

  getActiveCall(): ActiveCallState {
    return { ...this.activeCall };
  }

  // --------------------------------------------------------------------------
  // Signaling Dispatcher (SDP Offers, Answers, ICE Candidates)
  // --------------------------------------------------------------------------
  private async handleSignalingPayload(payload: SignalingPayload): Promise<void> {
    const peerUserId = payload.senderId;
    if (!peerUserId || peerUserId === this.currentUserId) return;

    switch (payload.type) {
      case 'connect-ping': {
        // Deterministic initiator check: peer with smaller ID initiates
        if (this.currentUserId! < peerUserId) {
          const session = this.peers.get(peerUserId);
          if (!session || session.status === 'idle' || session.status === 'failed' || session.status === 'disconnected') {
            console.log(`[WebRTC] Received connect-ping from ${peerUserId}, initiating as designated initiator.`);
            await this.connectToPeer(peerUserId, undefined, true);
          }
        }
        break;
      }

      case 'offer': {
        if (!payload.sdp) return;
        let session = this.peers.get(peerUserId);
        if (!session) {
          session = this.createPeerSession(peerUserId, false);
        }

        // Perfect Negotiation Pattern:
        // Polite peer is deterministic: e.g. currentUserId > peerUserId
        const isPolite = this.currentUserId! > peerUserId;
        const offerCollision = session.makingOffer || session.pc.signalingState !== 'stable';

        session.ignoreOffer = !isPolite && offerCollision;
        if (session.ignoreOffer) {
          console.warn(`[WebRTC Glare] Collision with ${peerUserId}. Impolite peer re-asserts local offer.`);
          if (session.pc.localDescription) {
            await signalingService.sendSignal({
              type: 'offer',
              senderId: this.currentUserId!,
              targetId: peerUserId,
              sessionId: 'reassert_' + Date.now(),
              sdp: session.pc.localDescription,
              timestamp: Date.now()
            });
          }
          return;
        }

        if (offerCollision && isPolite) {
          console.log(`[WebRTC Glare] Collision with ${peerUserId}. Polite peer rolling back local offer.`);
          try {
            await session.pc.setLocalDescription({ type: 'rollback' });
          } catch (e) {
            console.warn('[WebRTC] Rollback warning:', e);
          }
        }

        try {
          await session.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

          // Drain queued ICE candidates
          for (const candidate of session.pendingCandidates) {
            try {
              if (candidate && candidate.candidate) {
                await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
            } catch (err) {
              console.warn('[WebRTC] Error adding queued ICE candidate:', err);
            }
          }
          session.pendingCandidates = [];

          // Create and send SDP answer
          const answer = await session.pc.createAnswer();
          await session.pc.setLocalDescription(answer);

          await signalingService.sendSignal({
            type: 'answer',
            senderId: this.currentUserId!,
            targetId: peerUserId,
            sessionId: payload.sessionId,
            sdp: answer,
            timestamp: Date.now()
          });

          this.updateStatus(peerUserId, 'connecting');
        } catch (err: any) {
          console.error('[WebRTC] Error processing offer from:', peerUserId, err);
          this.updateStatus(peerUserId, 'failed', err.message);
        }
        break;
      }

      case 'answer': {
        if (!payload.sdp) return;
        const session = this.peers.get(peerUserId);
        if (!session) return;

        if (session.pc.signalingState === 'stable') {
          console.warn(`[WebRTC] Received answer for ${peerUserId} while already stable; ignoring.`);
          return;
        }

        try {
          await session.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

          // Drain pending candidates
          for (const candidate of session.pendingCandidates) {
            try {
              if (candidate && candidate.candidate) {
                await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
            } catch (err) {
              console.warn('[WebRTC] Error adding queued candidate after answer:', err);
            }
          }
          session.pendingCandidates = [];
          this.updateStatus(peerUserId, 'connecting');
        } catch (err: any) {
          console.error('[WebRTC] Error processing answer from:', peerUserId, err);
        }
        break;
      }

      case 'ice-candidate': {
        if (!payload.candidate || !payload.candidate.candidate) return;
        const session = this.peers.get(peerUserId);
        if (session) {
          if (session.pc.remoteDescription && session.pc.remoteDescription.type) {
            try {
              await session.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
              if (!session.ignoreOffer) {
                console.warn('[WebRTC] Error adding ICE candidate:', err);
              }
            }
          } else {
            session.pendingCandidates.push(payload.candidate);
          }
        }
        break;
      }

      case 'call-invite': {
        if (this.activeCall.active) {
          // Busy
          await signalingService.sendSignal({
            type: 'call-reject',
            senderId: this.currentUserId!,
            targetId: peerUserId,
            sessionId: payload.sessionId,
            timestamp: Date.now()
          });
          return;
        }

        const senderProfile = await supabaseService.getProfile(peerUserId);
        this.activeCall = {
          active: true,
          callType: payload.callType || 'voice',
          isIncoming: true,
          remoteUserId: peerUserId,
          remoteUserName: senderProfile?.display_name || 'Contact',
          status: 'ringing',
          isMuted: false,
          isVideoOff: false
        };
        this.notifyCallStateChange();
        break;
      }

      case 'call-accept': {
        if (this.activeCall.active && this.activeCall.remoteUserId === peerUserId) {
          this.activeCall.status = 'connected';
          this.activeCall.startedAt = Date.now();
          this.notifyCallStateChange();

          // Caller ensures its tracks are renegotiated with receiver
          const session = this.peers.get(peerUserId);
          if (session && this.localMediaStream) {
            try {
              session.makingOffer = true;
              const offer = await session.pc.createOffer();
              await session.pc.setLocalDescription(offer);
              await signalingService.sendSignal({
                type: 'offer',
                senderId: this.currentUserId!,
                targetId: peerUserId,
                sessionId: 'call_ack_' + Date.now(),
                sdp: offer,
                callType: this.activeCall.callType,
                timestamp: Date.now()
              });
            } catch (err) {
              console.warn('[WebRTC] Error in caller renegotiation after call-accept:', err);
            } finally {
              session.makingOffer = false;
            }
          }
        }
        break;
      }

      case 'call-reject': {
        if (this.activeCall.active && this.activeCall.remoteUserId === peerUserId) {
          this.endCall();
        }
        break;
      }

      case 'call-end': {
        if (this.activeCall.active && this.activeCall.remoteUserId === peerUserId) {
          this.endCall();
        }
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Helpers & Listeners
  // --------------------------------------------------------------------------
  private async ensureConnectedSession(peerUserId: string): Promise<PeerSession> {
    let session = this.peers.get(peerUserId);
    if (!session || session.status === 'failed' || session.status === 'disconnected') {
      session = await this.connectToPeer(peerUserId);
    }
    return session;
  }

  getPeerStatus(peerUserId: string): PeerConnectionStatus {
    return this.peers.get(peerUserId)?.status || 'idle';
  }

  getPeerErrorReason(peerUserId: string): string | undefined {
    return this.peers.get(peerUserId)?.errorReason;
  }

  onPeerStatusChange(handler: PeerStatusChangeHandler): () => void {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }

  onMessageReceived(handler: MessageReceivedHandler): () => void {
    this.messageListeners.add(handler);
    return () => this.messageListeners.delete(handler);
  }

  onTypingChange(handler: TypingChangeHandler): () => void {
    this.typingListeners.add(handler);
    return () => this.typingListeners.delete(handler);
  }

  onCallStateChange(handler: CallStateChangeHandler): () => void {
    this.callListeners.add(handler);
    return () => this.callListeners.delete(handler);
  }

  onRemoteStream(handler: RemoteStreamHandler): () => void {
    this.streamListeners.add(handler);
    return () => this.streamListeners.delete(handler);
  }

  private updateStatus(peerUserId: string, status: PeerConnectionStatus, errorReason?: string): void {
    if (status === 'connected' || status === 'failed' || status === 'idle') {
      this.clearWatchdog(peerUserId);
    }
    const session = this.peers.get(peerUserId);
    if (session) {
      session.status = status;
      session.errorReason = errorReason;
    }
    for (const listener of this.statusListeners) {
      listener(peerUserId, status, errorReason);
    }
  }

  private notifyCallStateChange(): void {
    const copy = { ...this.activeCall };
    for (const listener of this.callListeners) {
      listener(copy);
    }
  }

  closePeerSession(peerUserId: string): void {
    this.clearRecoveryTimeout(peerUserId);
    this.clearWatchdog(peerUserId);
    const session = this.peers.get(peerUserId);
    if (session) {
      if (session.dataChannel) {
        session.dataChannel.close();
      }
      session.pc.close();
      this.peers.delete(peerUserId);
      this.updateStatus(peerUserId, 'idle');
    }
  }

  // --------------------------------------------------------------------------
  // Connection Self-Healing & Automatic Recovery
  // --------------------------------------------------------------------------
  private recoveryTimeouts: Map<string, any> = new Map();
  private watchdogTimers: Map<string, any> = new Map();

  private clearWatchdog(peerUserId: string): void {
    const timer = this.watchdogTimers.get(peerUserId);
    if (timer) {
      clearTimeout(timer);
      this.watchdogTimers.delete(peerUserId);
    }
  }

  private startConnectionWatchdog(peerUserId: string): void {
    this.clearWatchdog(peerUserId);
    const timer = setTimeout(() => {
      this.watchdogTimers.delete(peerUserId);
      const session = this.peers.get(peerUserId);
      if (session && (session.status === 'signaling' || session.status === 'connecting')) {
        console.warn(`[WebRTC Watchdog] Connection timeout for ${peerUserId}. Initiating recovery...`);
        this.handleConnectionRecovery(peerUserId, false);
      }
    }, 12000);
    this.watchdogTimers.set(peerUserId, timer);
  }

  private clearRecoveryTimeout(peerUserId: string): void {
    const existing = this.recoveryTimeouts.get(peerUserId);
    if (existing) {
      clearTimeout(existing);
      this.recoveryTimeouts.delete(peerUserId);
    }
  }

  private handleConnectionRecovery(peerUserId: string, isFailed: boolean = false): void {
    if (this.recoveryTimeouts.has(peerUserId)) return;

    const session = this.peers.get(peerUserId);
    if (!session) return;

    console.log(`[WebRTC] Initiating automatic connection recovery for ${peerUserId} (failed: ${isFailed})...`);
    this.updateStatus(peerUserId, 'connecting');

    const timeout = setTimeout(async () => {
      this.recoveryTimeouts.delete(peerUserId);
      const current = this.peers.get(peerUserId);
      if (!current || current.status === 'connected') return;

      try {
        if ('restartIce' in current.pc && !isFailed && current.pc.signalingState === 'stable') {
          console.log(`[WebRTC] Attempting ICE restart for ${peerUserId}...`);
          current.pc.restartIce();
          current.makingOffer = true;
          const offer = await current.pc.createOffer({ iceRestart: true });
          await current.pc.setLocalDescription(offer);
          await signalingService.sendSignal({
            type: 'offer',
            senderId: this.currentUserId!,
            targetId: peerUserId,
            sessionId: 'restart_' + Date.now(),
            sdp: offer,
            timestamp: Date.now()
          });
        } else {
          console.log(`[WebRTC] Performing full connection recovery restart for ${peerUserId}...`);
          await this.retryPeerConnection(peerUserId);
        }
      } catch (err: any) {
        console.warn(`[WebRTC] Recovery attempt failed for ${peerUserId}:`, err);
        this.updateStatus(peerUserId, 'failed', 'Direct P2P connection failed. Network NAT or firewall prevented direct traversal (Relay/TURN is strictly disabled).');
      }
    }, 1500);

    this.recoveryTimeouts.set(peerUserId, timeout);
  }

  async retryPeerConnection(peerUserId: string): Promise<void> {
    console.log(`[WebRTC] Retrying direct P2P connection to ${peerUserId}...`);
    this.closePeerSession(peerUserId);
    await this.connectToPeer(peerUserId, undefined, true);
  }

  cleanup(): void {
    this.endCall();
    for (const [peerId] of this.watchdogTimers) {
      this.clearWatchdog(peerId);
    }
    for (const [peerId, _] of this.peers) {
      this.closePeerSession(peerId);
    }
    this.peers.clear();
    this.statusListeners.clear();
    this.messageListeners.clear();
    this.typingListeners.clear();
    this.callListeners.clear();
    this.streamListeners.clear();
  }
}

export const peerManager = new PeerConnectionManager();
