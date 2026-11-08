import Dexie, { type Table } from 'dexie';
import type { 
  LocalMessage, 
  LocalConversation, 
  CachedPeerData, 
  DeviceKeypairRecord 
} from '@/types';

// ============================================================================
// Local IndexedDB Database (Dexie.js)
// STRICT PRIVACY RULE: All chat history, messages, transferred file blobs, 
// and private cryptographic keys reside ONLY on this device.
// ZERO synchronization to Supabase or any cloud database.
// ============================================================================

export class P2PChatDatabase extends Dexie {
  conversations!: Table<LocalConversation, string>;
  messages!: Table<LocalMessage, string>;
  cachedPeers!: Table<CachedPeerData, string>;
  deviceKeys!: Table<DeviceKeypairRecord, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('P2PChatLocalDB');

    this.version(1).stores({
      // Primary key: id, indexed fields: type, lastMessageTimestamp
      conversations: 'id, type, lastMessageTimestamp',
      // Primary key: id, indexed fields: conversationId, senderId, timestamp, type, status
      messages: 'id, conversationId, senderId, timestamp, type, status',
      // Primary key: userId
      cachedPeers: 'userId, cachedAt',
      // Primary key: id
      deviceKeys: 'id, createdAt',
      // Primary key: key
      settings: 'key'
    });
  }

  // --------------------------------------------------------------------------
  // Message Operations
  // --------------------------------------------------------------------------
  async saveMessage(message: LocalMessage): Promise<void> {
    await this.transaction('rw', this.messages, this.conversations, async () => {
      await this.messages.put(message);

      // Update or create conversation summary
      const existingConv = await this.conversations.get(message.conversationId);
      const isIncoming = message.status === 'delivered';
      
      const updatedConv: LocalConversation = {
        id: message.conversationId,
        type: existingConv ? existingConv.type : 'direct',
        displayName: existingConv ? existingConv.displayName : message.senderName,
        lastMessageText: message.type === 'file' 
          ? `[File: ${message.fileMetadata?.name || 'Attachment'}]` 
          : message.content,
        lastMessageTimestamp: message.timestamp,
        unreadCount: isIncoming ? ((existingConv?.unreadCount || 0) + 1) : (existingConv?.unreadCount || 0)
      };

      await this.conversations.put(updatedConv);
    });
  }

  async getMessages(conversationId: string, _limit = 200): Promise<LocalMessage[]> {
    return await this.messages
      .where('conversationId')
      .equals(conversationId)
      .sortBy('timestamp');
  }

  async updateMessageStatus(id: string, status: LocalMessage['status']): Promise<void> {
    await this.messages.update(id, { status });
  }

  async deleteMessage(id: string): Promise<void> {
    await this.messages.delete(id);
  }

  async clearConversation(conversationId: string): Promise<void> {
    await this.transaction('rw', this.messages, this.conversations, async () => {
      await this.messages.where('conversationId').equals(conversationId).delete();
      await this.conversations.update(conversationId, {
        lastMessageText: '[Conversation cleared]',
        lastMessageTimestamp: Date.now(),
        unreadCount: 0
      });
    });
  }

  async resetUnreadCount(conversationId: string): Promise<void> {
    await this.conversations.update(conversationId, { unreadCount: 0 });
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.transaction('rw', this.messages, this.conversations, async () => {
      await this.messages.where('conversationId').equals(conversationId).delete();
      await this.conversations.delete(conversationId);
    });
  }

  async wipeAllLocalData(): Promise<void> {
    await this.transaction('rw', this.messages, this.conversations, this.cachedPeers, this.settings, async () => {
      await this.messages.clear();
      await this.conversations.clear();
      await this.cachedPeers.clear();
      await this.settings.clear();
    });
  }

  // --------------------------------------------------------------------------
  // Peer Identity & Avatar Cache (Direct P2P Cached Data)
  // --------------------------------------------------------------------------
  async saveCachedPeer(peerData: CachedPeerData): Promise<void> {
    await this.cachedPeers.put(peerData);
  }

  async getCachedPeer(userId: string): Promise<CachedPeerData | undefined> {
    return await this.cachedPeers.get(userId);
  }

  // --------------------------------------------------------------------------
  // Device Cryptographic Keypair (ECDH P-256)
  // --------------------------------------------------------------------------
  async saveDeviceKeypair(record: DeviceKeypairRecord): Promise<void> {
    await this.deviceKeys.put(record);
  }

  async getDeviceKeypair(): Promise<DeviceKeypairRecord | undefined> {
    return await this.deviceKeys.get('current_user_keypair');
  }

  // --------------------------------------------------------------------------
  // Local Settings & Avatars
  // --------------------------------------------------------------------------
  async setSetting(key: string, value: unknown): Promise<void> {
    await this.settings.put({ key, value });
  }

  async getSetting<T>(key: string): Promise<T | undefined> {
    const record = await this.settings.get(key);
    return record?.value as T | undefined;
  }

  // --------------------------------------------------------------------------
  // Blocked Users Management (Local Privacy Enforcement)
  // --------------------------------------------------------------------------
  async getBlockedUsers(): Promise<string[]> {
    const list = await this.getSetting<string[]>('blocked_users');
    return list || [];
  }

  async blockUser(userId: string): Promise<void> {
    const list = await this.getBlockedUsers();
    if (!list.includes(userId)) {
      list.push(userId);
      await this.setSetting('blocked_users', list);
    }
  }

  async unblockUser(userId: string): Promise<void> {
    const list = await this.getBlockedUsers();
    const filtered = list.filter(id => id !== userId);
    await this.setSetting('blocked_users', filtered);
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    const list = await this.getBlockedUsers();
    return list.includes(userId);
  }
}

// Singleton database instance
export const localDb = new P2PChatDatabase();
