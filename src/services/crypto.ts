import { localDb } from './db';
import type { DeviceKeypairRecord } from '@/types';

// ============================================================================
// Web Crypto API Application-Level End-to-End Encryption (E2EE)
// Algorithm: ECDH (P-256) Key Agreement + AES-256-GCM Direct Payload Encryption
// Audited Standards: W3C Web Cryptography API (SubtleCrypto)
// STRICT SECURITY RULE: Private keys are generated locally and NEVER transmitted.
// ============================================================================

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string;         // Base64 12-byte IV
}

class CryptoService {
  private keyCache: Map<string, CryptoKey> = new Map(); // peerUserId -> derived AES-GCM key
  private localPrivateKey: CryptoKey | null = null;
  private localPublicKeyJWK: string | null = null;

  /**
   * Initializes or loads the device ECDH identity keypair from local IndexedDB.
   * If none exists, generates a new P-256 keypair and saves it locally.
   */
  async getOrCreateDeviceKeypair(): Promise<{ publicKeyJWK: string; privateKey: CryptoKey }> {
    if (this.localPrivateKey && this.localPublicKeyJWK) {
      return { publicKeyJWK: this.localPublicKeyJWK, privateKey: this.localPrivateKey };
    }

    let stored: DeviceKeypairRecord | undefined;
    try {
      stored = await localDb.getDeviceKeypair();
    } catch (err) {
      console.warn('Could not read keypair from localDb:', err);
    }

    if (stored) {
      try {
        const privateKey = await crypto.subtle.importKey(
          'jwk',
          JSON.parse(stored.privateKeyJWK),
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          ['deriveKey', 'deriveBits']
        );
        this.localPrivateKey = privateKey;
        this.localPublicKeyJWK = stored.publicKeyJWK;
        return { publicKeyJWK: stored.publicKeyJWK, privateKey };
      } catch (err) {
        console.warn('Failed to import existing keypair, generating fresh keypair:', err);
      }
    }

    // Generate new ECDH P-256 keypair
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateJWK = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    const publicJWKStr = JSON.stringify(publicJWK);
    const privateJWKStr = JSON.stringify(privateJWK);

    const record: DeviceKeypairRecord = {
      id: 'current_user_keypair',
      publicKeyJWK: publicJWKStr,
      privateKeyJWK: privateJWKStr,
      createdAt: Date.now()
    };

    try {
      await localDb.saveDeviceKeypair(record);
    } catch (err) {
      console.warn('Could not save keypair to localDb:', err);
    }

    this.localPrivateKey = keyPair.privateKey;
    this.localPublicKeyJWK = publicJWKStr;

    return { publicKeyJWK: publicJWKStr, privateKey: keyPair.privateKey };
  }

  /**
   * Derives a shared AES-256-GCM session key with a peer using ECDH.
   */
  async getOrDeriveSharedKey(peerUserId: string, peerPublicKeyJWKStr: string): Promise<CryptoKey> {
    const cacheKey = `${peerUserId}:${peerPublicKeyJWKStr}`;
    const cached = this.keyCache.get(cacheKey);
    if (cached) return cached;

    const { privateKey } = await this.getOrCreateDeviceKeypair();

    // Import peer's public key
    const peerPublicKey = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(peerPublicKeyJWKStr),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    // Derive symmetric AES-GCM 256-bit key
    const sharedKey = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: peerPublicKey
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false, // non-extractable in memory
      ['encrypt', 'decrypt']
    );

    this.keyCache.set(cacheKey, sharedKey);
    return sharedKey;
  }

  /**
   * Derives a shared AES-256-GCM session key directly from an in-band public key.
   */
  async deriveSharedKeyDirect(peerPublicKeyJWKStr: string): Promise<CryptoKey> {
    const { privateKey } = await this.getOrCreateDeviceKeypair();
    const peerPublicKey = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(peerPublicKeyJWKStr),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: peerPublicKey
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts plaintext string with AES-256-GCM using unique 12-byte random IV.
   */
  async encryptText(text: string, sharedKey: CryptoKey): Promise<EncryptedPayload> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      data
    );

    return {
      ciphertext: this.arrayBufferToBase64(ciphertextBuffer),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  /**
   * Decrypts ciphertext with AES-256-GCM.
   */
  async decryptText(payload: EncryptedPayload, sharedKey: CryptoKey): Promise<string> {
    const ciphertext = this.base64ToArrayBuffer(payload.ciphertext);
    const iv = this.base64ToArrayBuffer(payload.iv);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Encrypts binary chunk (for files/images/videos) with AES-256-GCM.
   */
  async encryptBinaryChunk(chunk: ArrayBuffer, sharedKey: CryptoKey): Promise<EncryptedPayload> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      chunk
    );

    return {
      ciphertext: this.arrayBufferToBase64(ciphertextBuffer),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  /**
   * Decrypts binary chunk with AES-256-GCM.
   */
  async decryptBinaryChunk(payload: EncryptedPayload, sharedKey: CryptoKey): Promise<ArrayBuffer> {
    const ciphertext = this.base64ToArrayBuffer(payload.ciphertext);
    const iv = this.base64ToArrayBuffer(payload.iv);

    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      ciphertext
    );
  }

  /**
   * Generates a secure random unique public ID formatted as `p2p_` + 10 hex characters.
   */
  generatePublicId(): string {
    const rand = crypto.getRandomValues(new Uint8Array(5));
    return 'p2p_' + Array.from(rand, b => b.toString(16).padStart(2, '0')).join('');
  }

  // --------------------------------------------------------------------------
  // Base64 helpers
  // --------------------------------------------------------------------------
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const cryptoService = new CryptoService();
