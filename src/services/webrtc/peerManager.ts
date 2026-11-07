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

  /**
   * Initializes the manager with current user profile.
   */
  init(userId: string, displayName: string): void {
    this.currentUserId = userId;
    this.currentUserName = displayName;

    // Listen to incoming signaling broadcasts
    signalingService.onMessage(this.handleSignalingPayload.bind(this));
  }

  // --------------------------------------------------------------------------
  // Connection Establishment (1-to-1 P2P)
  // --------------------------------------------------------------------------
  /**
   * Connects to a peer over STUN-only WebRTC.
   * If already connected, returns existing session.
   */
  async connectToPeer(peerUserId: string, peerPublicKeyJWK?: string): Promise<PeerSession> {
    const existing = this.peers.get(peerUserId);
    if (existing && (existing.status === 'connected' || existing.status === 'connecting')) {
      return existing;
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

    const session = this.createPeerSession(peerUserId, true, pubKey);

    // Create RTCDataChannel as initiator
    const dc = session.pc.createDataChannel('p2p-chat-e2ee', {
      ordered: true
    });
    this.setupDataChannel(peerUserId, dc);
    session.dataChannel = dc;

    // Create and send SDP Offer
    try {
      this.updateStatus(peerUserId, 'signaling');
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
      console.error('Error creating offer for peer:', peerUserId, err);
      this.updateStatus(peerUserId, 'failed', err.message);
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
      isInitiator
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
        });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        this.updateStatus(peerUserId, 'connected');
      } else if (state === 'connecting') {
        this.updateStatus(peerUserId, 'connecting');
      } else if (state === 'disconnected') {
        this.updateStatus(peerUserId, 'disconnected');
      } else if (state === 'failed') {
        // Clear diagnostic: STUN-only traversal failed due to restrictive NAT/firewall
        const reason = 'Direct P2P connection failed. Network NAT or firewall prevented direct traversal (Relay/TURN is strictly disabled).';
        this.updateStatus(peerUserId, 'failed', reason);
      }
    };

    // ICE Connection State
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        const reason = 'ICE direct connectivity negotiation failed (No TURN relay configured).';
        this.updateStatus(peerUserId, 'failed', reason);
      }
    };

    // Incoming DataChannel (for receiver)
    pc.ondatachannel = (event) => {
      session.dataChannel = event.channel;
      this.setupDataChannel(peerUserId, event.channel);
    };

    // Incoming MediaStream Tracks (Voice & Video)
    pc.ontrack = (event) => {
      let stream = this.remoteStreams.get(peerUserId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(peerUserId, stream);
      }
      stream.addTrack(event.track);
      for (const listener of this.streamListeners) {
        listener(peerUserId, stream);
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

      // Attempt to establish shared AES-256-GCM session key
      const session = this.peers.get(peerUserId);
      if (session) {
        if (!session.peerPublicKeyJWK) {
          session.peerPublicKeyJWK = (await supabaseService.getPeerPublicKey(peerUserId)) || null;
        }
        if (session.peerPublicKeyJWK) {
          try {
            session.sharedKey = await cryptoService.getOrDeriveSharedKey(peerUserId, session.peerPublicKeyJWK);
          } catch (e) {
            console.warn('Could not derive E2EE shared key for peer:', e);
          }
        }
      }
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
      case 'CHAT_MESSAGE': {
        let textContent = '';
        let isE2EE = false;

        if (packet.ciphertext && packet.iv && session?.sharedKey) {
          try {
            textContent = await cryptoService.decryptText(
              { ciphertext: packet.ciphertext, iv: packet.iv },
              session.sharedKey
            );
            isE2EE = true;
          } catch (err) {
            console.error('Failed to decrypt incoming text with shared key:', err);
            textContent = '[Decryption failed]';
          }
        } else if (packet.ciphertext) {
          textContent = atob(packet.ciphertext);
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

        // Notify UI listeners
        for (const listener of this.messageListeners) {
          listener(localMsg);
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

    if (!session.dataChannel || session.dataChannel.readyState !== 'open') {
      throw new Error('Direct P2P DataChannel is not open. Check connectivity status.');
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
      iv: iv || undefined
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
  async startCall(
    peerUserId: string, 
    callType: 'voice' | 'video',
    peerDisplayName: string
  ): Promise<void> {
    // 1. Acquire local media
    this.localMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video'
    });

    this.activeCall = {
      active: true,
      callType,
      isIncoming: false,
      remoteUserId: peerUserId,
      remoteUserName: peerDisplayName,
      status: 'initiating',
      isMuted: false,
      isVideoOff: false,
      startedAt: Date.now()
    };
    this.notifyCallStateChange();

    // 2. Connect or attach tracks to peer connection
    let session = this.peers.get(peerUserId);
    if (!session || session.status !== 'connected') {
      session = await this.connectToPeer(peerUserId);
    } else {
      // Add tracks to existing connection and renegotiate
      for (const track of this.localMediaStream.getTracks()) {
        session.pc.addTrack(track, this.localMediaStream);
      }
      const offer = await session.pc.createOffer();
      await session.pc.setLocalDescription(offer);
      await signalingService.sendSignal({
        type: 'offer',
        senderId: this.currentUserId!,
        targetId: peerUserId,
        sessionId: 'call_' + Date.now(),
        sdp: offer,
        callType,
        timestamp: Date.now()
      });
    }

    // 3. Send call invitation signal
    await signalingService.sendSignal({
      type: 'call-invite',
      senderId: this.currentUserId!,
      targetId: peerUserId,
      sessionId: 'call_' + Date.now(),
      callType,
      timestamp: Date.now()
    });

    this.activeCall.status = 'ringing';
    this.notifyCallStateChange();
  }

  async acceptCall(callType?: 'voice' | 'video'): Promise<void> {
    if (!this.activeCall.active || !this.activeCall.remoteUserId) return;

    const actualType = callType || this.activeCall.callType;

    // 1. Acquire local media
    try {
      this.localMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: actualType === 'video'
      });
    } catch (err: any) {
      console.error('Media permission denied:', err);
      this.rejectCall();
      throw new Error('Camera/Microphone permission denied: ' + err.message);
    }

    this.activeCall.status = 'connected';
    this.activeCall.startedAt = Date.now();
    this.notifyCallStateChange();

    // 2. Attach tracks to peer connection
    const session = this.peers.get(this.activeCall.remoteUserId);
    if (session && this.localMediaStream) {
      for (const track of this.localMediaStream.getTracks()) {
        session.pc.addTrack(track, this.localMediaStream);
      }
    }

    // 3. Send acceptance signal
    await signalingService.sendSignal({
      type: 'call-accept',
      senderId: this.currentUserId!,
      targetId: this.activeCall.remoteUserId,
      sessionId: 'call_' + Date.now(),
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

    switch (payload.type) {
      case 'offer': {
        if (!payload.sdp) return;
        let session = this.peers.get(peerUserId);
        if (!session) {
          session = this.createPeerSession(peerUserId, false);
        }

        await session.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        // Drain pending ICE candidates
        for (const candidate of session.pendingCandidates) {
          await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
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
        break;
      }

      case 'answer': {
        if (!payload.sdp) return;
        const session = this.peers.get(peerUserId);
        if (session && session.pc.signalingState !== 'stable') {
          await session.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

          // Drain pending candidates
          for (const candidate of session.pendingCandidates) {
            await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          session.pendingCandidates = [];
          this.updateStatus(peerUserId, 'connecting');
        }
        break;
      }

      case 'ice-candidate': {
        if (!payload.candidate) return;
        const session = this.peers.get(peerUserId);
        if (session) {
          if (session.pc.remoteDescription) {
            await session.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
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

  cleanup(): void {
    this.endCall();
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
