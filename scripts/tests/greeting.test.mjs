import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

async function setup() {
  const result = await build({
    entryPoints: ['src/widget/registerGreeting.ts'],
    bundle: true, platform: 'node', format: 'cjs', write: false,
    external: ['@ethora/chat-component/roomStore', '@ethora/chat-component/roomStore/roomsSlice'],
  });
  const listeners = new Set();
  const state = { rooms: { rooms: {} } };
  const store = {
    getState: () => state,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    dispatch: ({ roomJID, message }) => {
      state.rooms.rooms[roomJID].messages.push(message);
      for (const fn of [...listeners]) fn();
    },
    notify: () => { for (const fn of [...listeners]) fn(); },
  };
  const module = { exports: {} };
  runInNewContext(result.outputFiles[0].text, {
    module, exports: module.exports, window: {},
    require: (id) => id.endsWith('roomsSlice') ? { addRoomMessage: (x) => x } : { store },
  });
  return { store, state, register: module.exports.registerGreeting, cleanup: module.exports.clearGreetingSubscriptions };
}

test('restored conversation keeps one greeting earlier than its history', async () => {
  const { store, state, register } = await setup();
  const room = state.rooms.rooms.room = { messages: [] };
  const created = Date.parse('2026-01-01T00:00:00Z');
  register({ roomJID: 'room', text: 'Welcome', botXmppUsername: 'bot', botName: 'Bot', roomCreatedAt: new Date(created).toISOString() });
  room.messages.push({ id: 'past', body: 'Earlier conversation', messageTimestampMs: created + 5000 });
  room.messages.sort((a, b) => a.messageTimestampMs - b.messageTimestampMs);
  store.notify();
  assert.deepEqual(room.messages.map(m => m.body), ['Welcome', 'Earlier conversation']);
  store.notify();
  assert.equal(room.messages.filter(m => m.body === 'Welcome').length, 1);
});

test('destroy unsubscribes so a later widget can register the same room', async () => {
  const { store, state, register, cleanup } = await setup();
  const room = state.rooms.rooms.room = { messages: [] };
  const input = { roomJID: 'room', text: 'Welcome', botXmppUsername: 'bot', botName: 'Bot' };
  register(input);
  cleanup();
  room.messages = [];
  store.notify();
  assert.equal(room.messages.length, 0);
  register(input);
  assert.equal(room.messages.length, 1);
});

test('older API sessions use the Mongo chat ID timestamp before history arrives', async () => {
  const { state, register } = await setup();
  const room = state.rooms.rooms.room = { messages: [] };
  register({ roomJID: 'room', text: 'Welcome', botXmppUsername: 'bot', botName: 'Bot', chatId: '6955b9000000000000000000' });
  assert.ok(room.messages[0].messageTimestampMs < Date.parse('2026-01-02T00:00:00Z'));
});
