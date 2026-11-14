import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { localDb } from '../src/services/db';
import type { LocalMessage } from '../src/types';

describe('Advanced IndexedDB Operations', () => {
  beforeEach(async () => {
    await localDb.wipeAllLocalData();
  });

  it('marks messages as read with double cyan ticks', async () => {
    const msg: LocalMessage = {
      id: 'msg_read_1',
      conversationId: 'alice',
      senderId: 'alice',
      senderName: 'Alice',
      type: 'text',
      content: 'Did you see this?',
      status: 'delivered',
      timestamp: Date.now(),
      isE2EE: true
    };
    await localDb.saveMessage(msg);

    await localDb.markMessagesAsRead(['msg_read_1']);
    const updated = await localDb.messages.get('msg_read_1');
    expect(updated?.status).toBe('read');
  });

  it('adds and aggregates emoji reactions', async () => {
    const msg: LocalMessage = {
      id: 'msg_react_1',
      conversationId: 'alice',
      senderId: 'alice',
      senderName: 'Alice',
      type: 'text',
      content: 'Direct P2P rocks!',
      status: 'delivered',
      timestamp: Date.now(),
      isE2EE: true
    };
    await localDb.saveMessage(msg);

    await localDb.addReaction('msg_react_1', '🔥', 'bob');
    await localDb.addReaction('msg_react_1', '🔥', 'charlie');
    await localDb.addReaction('msg_react_1', '❤️', 'alice');

    const updated = await localDb.messages.get('msg_react_1');
    expect(Object.keys(updated?.reactions || {}).length).toBe(2);

    const fireUsers = updated?.reactions?.['🔥'];
    expect(fireUsers?.length).toBe(2);
    expect(fireUsers).toContain('bob');
    expect(fireUsers).toContain('charlie');
  });

  it('edits message content in place and marks as edited', async () => {
    const msg: LocalMessage = {
      id: 'msg_edit_1',
      conversationId: 'alice',
      senderId: 'me',
      senderName: 'Me',
      type: 'text',
      content: 'Typo here!',
      status: 'sent',
      timestamp: Date.now(),
      isE2EE: true
    };
    await localDb.saveMessage(msg);

    const editTime = Date.now();
    await localDb.editMessage('msg_edit_1', 'Fixed text!', editTime);

    const updated = await localDb.messages.get('msg_edit_1');
    expect(updated?.content).toBe('Fixed text!');
    expect(updated?.isEdited).toBe(true);
    expect(updated?.editedAt).toBe(editTime);
  });

  it('burns view-once messages permanently', async () => {
    const msg: LocalMessage = {
      id: 'msg_view_once',
      conversationId: 'alice',
      senderId: 'alice',
      senderName: 'Alice',
      type: 'text',
      content: 'data:image/png;base64,SECRET_DATA',
      viewOnce: true,
      status: 'delivered',
      timestamp: Date.now(),
      isE2EE: true
    };
    await localDb.saveMessage(msg);

    await localDb.burnViewOnceMessage('msg_view_once');
    const updated = await localDb.messages.get('msg_view_once');
    expect(updated?.isViewed).toBe(true);
  });

  it('purges expired disappearing messages automatically', async () => {
    const pastTime = Date.now() - 5000;
    const futureTime = Date.now() + 60000;

    const expiredMsg: LocalMessage = {
      id: 'msg_expired',
      conversationId: 'alice',
      senderId: 'alice',
      senderName: 'Alice',
      type: 'text',
      content: 'Will self destruct',
      expiresAt: pastTime,
      status: 'delivered',
      timestamp: pastTime - 1000,
      isE2EE: true
    };

    const activeMsg: LocalMessage = {
      id: 'msg_active',
      conversationId: 'alice',
      senderId: 'alice',
      senderName: 'Alice',
      type: 'text',
      content: 'Still alive',
      expiresAt: futureTime,
      status: 'delivered',
      timestamp: Date.now(),
      isE2EE: true
    };

    await localDb.saveMessage(expiredMsg);
    await localDb.saveMessage(activeMsg);

    const purgedCount = await localDb.purgeExpiredMessages();
    expect(purgedCount).toBe(1);

    const messages = await localDb.getMessages('alice');
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe('msg_active');
  });

  it('searches messages by query string', async () => {
    const msg1: LocalMessage = {
      id: 's_1',
      conversationId: 'alice',
      senderId: 'alice',
      senderName: 'Alice',
      type: 'text',
      content: 'The secret passphrase is ALPHA',
      status: 'delivered',
      timestamp: Date.now() - 2000,
      isE2EE: true
    };
    const msg2: LocalMessage = {
      id: 's_2',
      conversationId: 'alice',
      senderId: 'me',
      senderName: 'Me',
      type: 'text',
      content: 'Understood, Roger that',
      status: 'sent',
      timestamp: Date.now() - 1000,
      isE2EE: true
    };

    await localDb.saveMessage(msg1);
    await localDb.saveMessage(msg2);

    const matches = await localDb.searchMessages('ALPHA', 'alice');
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe('s_1');
  });
});
