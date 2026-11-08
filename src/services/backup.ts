import { localDb } from './db';
import type { LocalMessage, LocalConversation, CachedPeerData } from '@/types';

// ============================================================================
// Encrypted Backup & Device Portability Service
// STRICT PRIVACY: Encrypts local IndexedDB data with AES-256-GCM using a
// user-defined passphrase derived via PBKDF2. Zero cloud backup.
// ============================================================================

export interface EncryptedBackupPayload {
  version: number;
  appName: string;
  exportedAt: number;
  salt: string; // Base64
  iv: string;   // Base64
  ciphertext: string; // Base64
}

class BackupService {
  /**
   * Derives an AES-GCM key from a user passphrase using PBKDF2 (100,000 iterations).
   */
  private async deriveKeyFromPassphrase(
    passphrase: string, 
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as unknown as BufferSource,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Exports all local conversations, messages, and contacts into a passphrase-encrypted file.
   */
  async exportBackup(passphrase: string): Promise<Blob> {
    if (!passphrase || passphrase.length < 4) {
      throw new Error('Passphrase must be at least 4 characters long.');
    }

    const conversations: LocalConversation[] = await localDb.conversations.toArray();
    const rawMessages: LocalMessage[] = await localDb.messages.toArray();
    const cachedPeers: CachedPeerData[] = await localDb.cachedPeers.toArray();

    // Prepare messages for serialization (strip local runtime ObjectURLs)
    const serializableMessages = rawMessages.map(m => {
      const copy = { ...m };
      if (copy.fileMetadata) {
        copy.fileMetadata = {
          ...copy.fileMetadata,
          blobUrl: undefined,
          dataBlob: undefined
        };
      }
      return copy;
    });

    const exportData = {
      conversations,
      messages: serializableMessages,
      cachedPeers,
      exportedAt: Date.now()
    };

    const jsonString = JSON.stringify(exportData);
    const enc = new TextEncoder();
    const encodedData = enc.encode(jsonString);

    // Generate random 16-byte salt and 12-byte IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await this.deriveKeyFromPassphrase(passphrase, salt);
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    const payload: EncryptedBackupPayload = {
      version: 1,
      appName: 'Shield P2P',
      exportedAt: Date.now(),
      salt: this.bytesToBase64(salt),
      iv: this.bytesToBase64(iv),
      ciphertext: this.bytesToBase64(new Uint8Array(ciphertextBuffer))
    };

    return new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
  }

  /**
   * Decrypts an uploaded backup file and restores conversations and messages into IndexedDB.
   */
  async importBackup(
    file: File, 
    passphrase: string
  ): Promise<{ messagesCount: number; conversationsCount: number }> {
    const text = await file.text();
    let payload: EncryptedBackupPayload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('Invalid backup file format.');
    }

    if (!payload.salt || !payload.iv || !payload.ciphertext) {
      throw new Error('Corrupted or invalid Shield P2P backup file.');
    }

    const salt = this.base64ToBytes(payload.salt);
    const iv = this.base64ToBytes(payload.iv);
    const ciphertext = this.base64ToBytes(payload.ciphertext);

    let decryptedBuffer: ArrayBuffer;
    try {
      const key = await this.deriveKeyFromPassphrase(passphrase, salt);
      decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        ciphertext as unknown as BufferSource
      );
    } catch {
      throw new Error('Incorrect passphrase or corrupted backup file.');
    }

    const dec = new TextDecoder();
    const jsonString = dec.decode(decryptedBuffer);
    const data = JSON.parse(jsonString);

    const conversations: LocalConversation[] = data.conversations || [];
    const messages: LocalMessage[] = data.messages || [];
    const cachedPeers: CachedPeerData[] = data.cachedPeers || [];

    // Merge into local IndexedDB
    await localDb.transaction('rw', localDb.conversations, localDb.messages, localDb.cachedPeers, async () => {
      for (const c of conversations) {
        await localDb.conversations.put(c);
      }
      for (const m of messages) {
        await localDb.messages.put(m);
      }
      for (const p of cachedPeers) {
        await localDb.cachedPeers.put(p);
      }
    });

    return {
      messagesCount: messages.length,
      conversationsCount: conversations.length
    };
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const backupService = new BackupService();
