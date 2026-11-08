import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { localDb } from '../src/services/db';
import type { LocalMessage } from '../src/types';

describe('IndexedDB Local History Storage (Dexie.js)', () => {
  beforeEach(async () => {
    await localDb.wipeAllLocalData();
  });

  it('saves and retrieves local conversation messages strictly on device', async () => {
    const peerId = 'peer_user_alice';
    const message1: LocalMessage = {
      id: 'msg_1',
      conversationId: peerId,
      senderId: 'me',
      senderName: 'Me',
      type: 'text',
      content: 'Hello Alice!',
      status: 'sent',
      timestamp: Date.now() - 1000,
      isE2EE: true
    };

    const message2: LocalMessage = {
      id: 'msg_2',
      conversationId: peerId,
      senderId: peerId,
      senderName: 'Alice',
      type: 'text',
      content: 'Hello! WebRTC is direct.',
      status: 'delivered',
      timestamp: Date.now(),
      isE2EE: true
    };

    await localDb.saveMessage(message1);
    await localDb.saveMessage(message2);

    const history = await localDb.getMessages(peerId);
    expect(history.length).toBe(2);
    expect(history[0].content).toBe('Hello Alice!');
    expect(history[1].content).toBe('Hello! WebRTC is direct.');

    // Check conversation summary entry
    const conv = await localDb.conversations.get(peerId);
    expect(conv).toBeDefined();
    expect(conv?.lastMessageText).toBe('Hello! WebRTC is direct.');
  });

  it('deletes an individual message locally', async () => {
    const peerId = 'peer_user_bob';
    const msg: LocalMessage = {
      id: 'msg_to_delete',
      conversationId: peerId,
      senderId: 'me',
      senderName: 'Me',
      type: 'text',
      content: 'Temporary message',
      status: 'sent',
      timestamp: Date.now(),
      isE2EE: true
    };

    await localDb.saveMessage(msg);
    let msgs = await localDb.getMessages(peerId);
    expect(msgs.length).toBe(1);

    await localDb.deleteMessage('msg_to_delete');
    msgs = await localDb.getMessages(peerId);
    expect(msgs.length).toBe(0);
  });

  it('clears an entire conversation locally', async () => {
    const peerId = 'peer_user_charlie';
    await localDb.saveMessage({
      id: 'm1',
      conversationId: peerId,
      senderId: peerId,
      senderName: 'Charlie',
      type: 'text',
      content: 'msg 1',
      status: 'delivered',
      timestamp: Date.now(),
      isE2EE: true
    });
    await localDb.saveMessage({
      id: 'm2',
      conversationId: peerId,
      senderId: 'me',
      senderName: 'Me',
      type: 'text',
      content: 'msg 2',
      status: 'sent',
      timestamp: Date.now() + 10,
      isE2EE: true
    });

    await localDb.clearConversation(peerId);
    const msgs = await localDb.getMessages(peerId);
    expect(msgs.length).toBe(0);

    const conv = await localDb.conversations.get(peerId);
    expect(conv?.lastMessageText).toBe('[Conversation cleared]');
  });

  it('blocks, unblocks, and verifies blocked users in local IndexedDB', async () => {
    const blockedTarget = 'bad_actor_99';
    expect(await localDb.isUserBlocked(blockedTarget)).toBe(false);

    await localDb.blockUser(blockedTarget);
    expect(await localDb.isUserBlocked(blockedTarget)).toBe(true);

    const list = await localDb.getBlockedUsers();
    expect(list).toContain(blockedTarget);

    await localDb.unblockUser(blockedTarget);
    expect(await localDb.isUserBlocked(blockedTarget)).toBe(false);
    expect((await localDb.getBlockedUsers()).length).toBe(0);
  });
});
