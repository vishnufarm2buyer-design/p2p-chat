import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// Polyfill minimal WebSocket for Node/Vitest environment
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

import { localDb } from '../src/services/db';
import { supabaseService } from '../src/services/supabase';

describe('Contact Lifecycle & Block Management', () => {
  beforeEach(async () => {
    await localDb.wipeAllLocalData();
  });

  it('rejects adding yourself as a contact', async () => {
    const userId = 'user_self_123';
    const result = await supabaseService.sendContactRequest(userId, userId);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Cannot add yourself as a contact');
  });

  it('allows adding a valid peer', async () => {
    const sender = 'user_alice_123';
    const receiver = 'user_bob_456';
    const result = await supabaseService.sendContactRequest(sender, receiver);
    expect(result.success).toBe(true);
  });

  it('correctly tracks blocked contacts and verifies isUserBlocked', async () => {
    const peerId = 'peer_spammer_789';

    // Initially not blocked
    expect(await localDb.isUserBlocked(peerId)).toBe(false);

    // Block peer
    await localDb.blockUser(peerId);
    expect(await localDb.isUserBlocked(peerId)).toBe(true);
    expect(await localDb.getBlockedUsers()).toContain(peerId);

    // Unblock peer
    await localDb.unblockUser(peerId);
    expect(await localDb.isUserBlocked(peerId)).toBe(false);
    expect(await localDb.getBlockedUsers()).not.toContain(peerId);
  });

  it('handles multiple blocked users and unblocking specific peers', async () => {
    const userA = 'user_a';
    const userB = 'user_b';
    const userC = 'user_c';

    await localDb.blockUser(userA);
    await localDb.blockUser(userB);
    await localDb.blockUser(userC);

    let blocked = await localDb.getBlockedUsers();
    expect(blocked.length).toBe(3);
    expect(blocked).toEqual(expect.arrayContaining([userA, userB, userC]));

    // Unblock userB only
    await localDb.unblockUser(userB);
    blocked = await localDb.getBlockedUsers();
    expect(blocked.length).toBe(2);
    expect(blocked).toContain(userA);
    expect(blocked).not.toContain(userB);
    expect(blocked).toContain(userC);
  });
});
