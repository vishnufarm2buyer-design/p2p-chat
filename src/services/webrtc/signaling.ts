import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import type { SignalingPayload } from '@/types';

// ============================================================================
// Ephemeral WebRTC Signaling Service via Supabase Realtime Broadcast
// STRICT ARCHITECTURAL PRINCIPLE:
// Signaling messages (offers, answers, ICE candidates) are temporary network
// negotiation metadata. They are NEVER stored in PostgreSQL or any database table.
// Cleaned up immediately upon connection or expiration.
// ============================================================================

export type SignalingMessageHandler = (payload: SignalingPayload) => void;
export type PresenceChangeHandler = (onlineUserIds: Set<string>) => void;

class SignalingService {
  private currentUserId: string | null = null;
  private messageHandlers: Set<SignalingMessageHandler> = new Set();
  private presenceHandlers: Set<PresenceChangeHandler> = new Set();
  private activeSignalingChannels: Map<string, RealtimeChannel> = new Map();
  private presenceChannel: RealtimeChannel | null = null;
  private onlineUserIds: Set<string> = new Set();

  /**
   * Initializes signaling and presence for the authenticated user.
   */
  async init(userId: string, publicId: string, displayName: string): Promise<void> {
    this.currentUserId = userId;

    // 1. Subscribe to personal incoming notification channel
    const notifyChannelName = `p2p:notify:${userId}`;
    const notifyChannel = supabase.channel(notifyChannelName, {
      config: { broadcast: { self: false } }
    });

    notifyChannel.on('broadcast', { event: 'signal' }, (event) => {
      const payload = event.payload as SignalingPayload;
      this.dispatchPayload(payload);
    });

    notifyChannel.subscribe();
    this.activeSignalingChannels.set(notifyChannelName, notifyChannel);

    // 2. Subscribe to Global Presence channel
    this.presenceChannel = supabase.channel('p2p:presence', {
      config: {
        presence: {
          key: userId
        }
      }
    });

    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenceChannel?.presenceState() || {};
        this.onlineUserIds.clear();
        for (const key of Object.keys(state)) {
          this.onlineUserIds.add(key);
        }
        this.notifyPresenceChange();
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        this.onlineUserIds.add(key);
        this.notifyPresenceChange();
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        this.onlineUserIds.delete(key);
        this.notifyPresenceChange();
      });

    this.presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.presenceChannel?.track({
          userId,
          publicId,
          displayName,
          onlineAt: Date.now()
        });
      }
    });
  }

  /**
   * Checks if a specific contact is currently online based on presence tracking.
   */
  isUserOnline(userId: string): boolean {
    return this.onlineUserIds.has(userId);
  }

  getOnlineUsers(): Set<string> {
    return new Set(this.onlineUserIds);
  }

  onPresenceChange(handler: PresenceChangeHandler): () => void {
    this.presenceHandlers.add(handler);
    handler(new Set(this.onlineUserIds));
    return () => this.presenceHandlers.delete(handler);
  }

  onMessage(handler: SignalingMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Joins a deterministic 1-to-1 signaling channel between two peers.
   */
  joinDirectSignalingChannel(peerUserId: string): RealtimeChannel {
    if (!this.currentUserId) throw new Error('Signaling not initialized');

    const channelName = this.getDirectChannelName(this.currentUserId, peerUserId);
    let channel = this.activeSignalingChannels.get(channelName);

    if (!channel) {
      channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } }
      });

      channel.on('broadcast', { event: 'signal' }, (event) => {
        const payload = event.payload as SignalingPayload;
        this.dispatchPayload(payload);
      });

      channel.subscribe();
      this.activeSignalingChannels.set(channelName, channel);
    }

    return channel;
  }

  /**
   * Sends signaling payload to target peer.
   * Transmits via both the direct pair channel and the recipient's notification channel.
   */
  async sendSignal(payload: SignalingPayload): Promise<void> {
    if (!this.currentUserId) return;

    payload.senderId = this.currentUserId;
    payload.timestamp = Date.now();

    // 1. Send to direct channel
    const directChannelName = this.getDirectChannelName(this.currentUserId, payload.targetId);
    let directChannel = this.activeSignalingChannels.get(directChannelName);
    if (!directChannel) {
      directChannel = this.joinDirectSignalingChannel(payload.targetId);
    }

    await directChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload
    });

    // 2. Also send to notify channel so the peer picks it up even if not already in the direct room
    const notifyChannel = supabase.channel(`p2p:notify:${payload.targetId}`);
    await notifyChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload
    });
  }

  /**
   * Joins group mesh signaling channel.
   */
  joinGroupMeshChannel(groupId: string, onSignal: (payload: SignalingPayload) => void): RealtimeChannel {
    const channelName = `p2p:group:${groupId}`;
    let channel = this.activeSignalingChannels.get(channelName);

    if (!channel) {
      channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } }
      });

      channel.on('broadcast', { event: 'signal' }, (event) => {
        const payload = event.payload as SignalingPayload;
        onSignal(payload);
      });

      channel.subscribe();
      this.activeSignalingChannels.set(channelName, channel);
    }

    return channel;
  }

  async sendGroupMeshSignal(groupId: string, payload: SignalingPayload): Promise<void> {
    const channelName = `p2p:group:${groupId}`;
    const channel = this.activeSignalingChannels.get(channelName);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'signal',
        payload
      });
    }
  }

  leaveChannel(channelName: string): void {
    const channel = this.activeSignalingChannels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.activeSignalingChannels.delete(channelName);
    }
  }

  cleanup(): void {
    if (this.presenceChannel) {
      this.presenceChannel.untrack();
      supabase.removeChannel(this.presenceChannel);
      this.presenceChannel = null;
    }
    for (const [_, ch] of this.activeSignalingChannels) {
      supabase.removeChannel(ch);
    }
    this.activeSignalingChannels.clear();
    this.messageHandlers.clear();
    this.presenceHandlers.clear();
    this.onlineUserIds.clear();
  }

  private getDirectChannelName(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort().join(':');
    return `p2p:signal:${sorted}`;
  }

  private dispatchPayload(payload: SignalingPayload): void {
    // Only process signals intended for current user or broadcast mesh
    if (payload.targetId && payload.targetId !== this.currentUserId) return;
    for (const handler of this.messageHandlers) {
      try {
        handler(payload);
      } catch (err) {
        console.error('Error in signaling message handler:', err);
      }
    }
  }

  private notifyPresenceChange(): void {
    const copy = new Set(this.onlineUserIds);
    for (const handler of this.presenceHandlers) {
      try {
        handler(copy);
      } catch (err) {
        console.error('Error in presence handler:', err);
      }
    }
  }
}

export const signalingService = new SignalingService();
