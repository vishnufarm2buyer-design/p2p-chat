import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';

describe('Web Crypto Application-Level E2EE', () => {
  it('generates ECDH P-256 keypairs for Alice and Bob and derives identical AES-256-GCM shared key', async () => {
    // 1. Alice generates ECDH P-256 keypair
    const aliceKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    // 2. Bob generates ECDH P-256 keypair
    const bobKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    // 3. Export public keys to JWK format (simulating sharing via Supabase public_keys table)
    const alicePublicJWK = await crypto.subtle.exportKey('jwk', aliceKeyPair.publicKey);
    const bobPublicJWK = await crypto.subtle.exportKey('jwk', bobKeyPair.publicKey);

    // 4. Import public keys
    const importedBobPublic = await crypto.subtle.importKey(
      'jwk',
      bobPublicJWK,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const importedAlicePublic = await crypto.subtle.importKey(
      'jwk',
      alicePublicJWK,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    // 5. Alice derives shared AES-GCM key using Bob's public key
    const aliceSharedKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: importedBobPublic },
      aliceKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      true, // extractable for assertion
      ['encrypt', 'decrypt']
    );

    // 6. Bob derives shared AES-GCM key using Alice's public key
    const bobSharedKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: importedAlicePublic },
      bobKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      true, // extractable for assertion
      ['encrypt', 'decrypt']
    );

    // Verify derived raw key bits are bit-for-bit identical
    const aliceRaw = await crypto.subtle.exportKey('raw', aliceSharedKey);
    const bobRaw = await crypto.subtle.exportKey('raw', bobSharedKey);

    expect(new Uint8Array(aliceRaw)).toEqual(new Uint8Array(bobRaw));

    // 7. Alice encrypts a message with AES-256-GCM
    const plaintext = 'Direct P2P Encrypted Message from Alice to Bob!';
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aliceSharedKey,
      data
    );

    // Verify ciphertext does not equal plaintext
    expect(new Uint8Array(ciphertext)).not.toEqual(data);

    // 8. Bob decrypts the message with AES-256-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      bobSharedKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decryptedBuffer);

    expect(decryptedText).toBe(plaintext);
  });

  it('generates different ciphertexts for identical messages using unique IVs', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const msg = 'Secret message';
    const data = new TextEncoder().encode(msg);

    const iv1 = crypto.getRandomValues(new Uint8Array(12));
    const ct1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv1 }, keyPair, data);

    const iv2 = crypto.getRandomValues(new Uint8Array(12));
    const ct2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv2 }, keyPair, data);

    expect(new Uint8Array(ct1)).not.toEqual(new Uint8Array(ct2));
  });
});
