import { peerManager } from './peerManager';
import { signalingService } from './signaling';
import { localDb } from '../db';
import type { GroupItem, LocalMessage, SignalingPayload, PeerConnectionStatus } from '@/types';

// ============================================================================
// Group Mesh Coordinator (Full Peer-to-Peer Mesh Architecture)
// For N participants, each member connects directly to N - 1 peers:
// Total direct P2P connections = N * (N - 1) / 2
// STRICT PRIVACY RULE: ZERO central relaying. Host coordinates initial signaling,
// but never relays chat messages, files, or audio/video.
// ============================================================================

export type GroupMeshStatusHandler = (groupId: string, memberStatusMap: Map<string, PeerConnectionStatus>) => void;

class GroupMeshManager {
  private currentUserId: string | null = null;
  private currentUserName: string = 'Me';
  private activeGroups: Map<string, GroupItem> = new Map();
  private groupPeerStatuses: Map<string, Map<string, PeerConnectionStatus>> = new Map();
  private statusListeners: Set<GroupMeshStatusHandler> = new Set();

  init(userId: string, userName: string): void {
    this.currentUserId = userId;
    this.currentUserName = userName;
  }

  /**
   * Joins a group mesh session. Connects to all other accepted group members directly.
   */
  async joinGroupMesh(group: GroupItem): Promise<void> {
    if (!this.currentUserId) return;
    this.activeGroups.set(group.id, group);

    const memberStatuses = new Map<string, PeerConnectionStatus>();
    this.groupPeerStatuses.set(group.id, memberStatuses);

    // 1. Join group ephemeral signaling channel
    signalingService.joinGroupMeshChannel(group.id, (payload: SignalingPayload) => {
      this.handleGroupMeshSignal(group.id, payload);
    });

    // 2. Announce presence in the mesh
    await signalingService.sendGroupMeshSignal(group.id, {
      type: 'mesh-member-joined',
      senderId: this.currentUserId,
      targetId: '', // broadcast
      sessionId: 'group_' + group.id,
      meshGroupId: group.id,
      timestamp: Date.now()
    });

    // 3. For each accepted member in the group, establish or reuse a direct peer connection
    // We enforce an initiator deterministic rule: user with smaller ID initiates to prevent collision
    for (const member of group.members) {
      if (member.user_id !== this.currentUserId && member.status === 'accepted') {
        memberStatuses.set(member.user_id, 'connecting');
        const shouldInitiate = this.currentUserId < member.user_id;
        if (shouldInitiate) {
          peerManager.connectToPeer(member.user_id).then(session => {
            memberStatuses.set(member.user_id, session.status);
            this.notifyStatusChange(group.id);
          }).catch(err => {
            console.error('Failed to mesh-connect to member:', member.user_id, err);
            memberStatuses.set(member.user_id, 'failed');
            this.notifyStatusChange(group.id);
          });
        }
      }
    }

    this.notifyStatusChange(group.id);
  }

  /**
   * Sends a group message directly to every connected member in the mesh.
   * Host does NOT forward. The sender sends to each peer directly!
   */
  async sendGroupMessage(groupId: string, text: string): Promise<LocalMessage> {
    const group = this.activeGroups.get(groupId);
    if (!group || !this.currentUserId) throw new Error('Not joined in group');

    const messageId = 'grp_msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const timestamp = Date.now();

    // Fan-out directly to all group members (Full Mesh Direct Transmission)
    const errors: string[] = [];
    for (const member of group.members) {
      if (member.user_id !== this.currentUserId && member.status === 'accepted') {
        try {
          await peerManager.sendMessage(member.user_id, `[GROUP:${groupId}]${text}`);
        } catch (err: any) {
          errors.push(member.user_id);
          console.warn(`Could not deliver group message to peer ${member.user_id}:`, err);
        }
      }
    }

    const localMsg: LocalMessage = {
      id: messageId,
      conversationId: groupId,
      senderId: this.currentUserId,
      senderName: this.currentUserName,
      type: 'text',
      content: text,
      status: errors.length === 0 ? 'sent' : 'failed',
      timestamp,
      isE2EE: true
    };

    await localDb.saveMessage(localMsg);
    return localMsg;
  }

  /**
   * Sends a file/media directly to every member in the mesh.
   */
  async sendGroupFile(groupId: string, file: File): Promise<LocalMessage> {
    const group = this.activeGroups.get(groupId);
    if (!group || !this.currentUserId) throw new Error('Not joined in group');

    const fileId = 'grp_file_' + Date.now();
    for (const member of group.members) {
      if (member.user_id !== this.currentUserId && member.status === 'accepted') {
        peerManager.sendFile(member.user_id, file).catch(err => {
          console.warn(`Could not deliver group file to peer ${member.user_id}:`, err);
        });
      }
    }

    const blobUrl = URL.createObjectURL(file);
    const localFileMsg: LocalMessage = {
      id: fileId,
      conversationId: groupId,
      senderId: this.currentUserId,
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
      isE2EE: true
    };

    await localDb.saveMessage(localFileMsg);
    return localFileMsg;
  }

  getMemberStatuses(groupId: string): Map<string, PeerConnectionStatus> {
    return this.groupPeerStatuses.get(groupId) || new Map();
  }

  onStatusChange(handler: GroupMeshStatusHandler): () => void {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }

  private handleGroupMeshSignal(groupId: string, payload: SignalingPayload): void {
    if (payload.senderId === this.currentUserId) return;

    if (payload.type === 'mesh-member-joined') {
      const group = this.activeGroups.get(groupId);
      if (group && this.currentUserId) {
        // If current user has smaller ID, initiate direct connection
        if (this.currentUserId < payload.senderId) {
          peerManager.connectToPeer(payload.senderId).then(session => {
            const memberMap = this.groupPeerStatuses.get(groupId);
            memberMap?.set(payload.senderId, session.status);
            this.notifyStatusChange(groupId);
          }).catch(console.error);
        }
      }
    }
  }

  private notifyStatusChange(groupId: string): void {
    const statuses = this.groupPeerStatuses.get(groupId);
    if (statuses) {
      for (const listener of this.statusListeners) {
        listener(groupId, new Map(statuses));
      }
    }
  }

  leaveGroupMesh(groupId: string): void {
    signalingService.leaveChannel(`p2p:group:${groupId}`);
    this.activeGroups.delete(groupId);
    this.groupPeerStatuses.delete(groupId);
  }
}

export const groupMeshManager = new GroupMeshManager();
