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

// Which opening line the visitor gets: a default nobody wrote for the site
// (the widget's own, or the platform template's from the server) is marked
// greetingIsDefault and shown in the reader's language; an owner's line or an
// embed attribute is shown as written.
async function loadResolver() {
  const result = await build({
    entryPoints: ['src/widget/resolveSession.ts'],
    bundle: true, platform: 'node', format: 'cjs', write: false,
    external: ['@ethora/chat-component/i18n/strings'],
  });
  const module = { exports: {} };
  runInNewContext(result.outputFiles[0].text, {
    module, exports: module.exports,
    require: () => ({ resolveStringTable: () => ({}), interpolate: (s) => s, toBaseLanguage: (l) => String(l).split('-')[0] }),
  });
  const i18n = await build({
    entryPoints: ['src/widget/i18n.ts'],
    bundle: true, platform: 'node', format: 'cjs', write: false,
    external: ['@ethora/chat-component/i18n/strings'],
  });
  const i18nModule = { exports: {} };
  runInNewContext(i18n.outputFiles[0].text, {
    module: i18nModule, exports: i18nModule.exports,
    require: () => ({ resolveStringTable: () => ({}), interpolate: (s) => s, toBaseLanguage: (l) => String(l).split('-')[0].toLowerCase() }),
  });
  return { resolve: module.exports.resolveSession, makeT: i18nModule.exports.makeT, DEFAULT_COPY: i18nModule.exports.DEFAULT_COPY };
}

const envelope = (bot) => ({
  visitor: { xmppUsername: 'app_widget-1', xmppPassword: 'p', uuid: '1' },
  room: { name: 'room', jid: 'room@conference.x', createdAt: null },
  bot: { xmppUsername: 'app_bot-bot', ...bot },
  xmpp: { host: 'x', service: 'wss://x/ws' },
});

test('no greeting from the server: the widget default, translatable', async () => {
  const { resolve, DEFAULT_COPY } = await loadResolver();
  const p = resolve(envelope({}), {}).persona;
  assert.equal(p.greetingMessage, DEFAULT_COPY.greeting);
  assert.equal(p.greetingIsDefault, true);
});

test('the platform template greeting is default, an owner greeting is not', async () => {
  const { resolve } = await loadResolver();
  assert.equal(resolve(envelope({ greetingMessage: 'Hi! I am the Support Agent.', greetingIsDefault: true }), {}).persona.greetingIsDefault, true);
  assert.equal(resolve(envelope({ greetingMessage: 'Welcome to our store!', greetingIsDefault: false }), {}).persona.greetingIsDefault, false);
  assert.equal(resolve(envelope({ greetingMessage: 'Welcome to our store!' }), {}).persona.greetingIsDefault, false, 'older server: no flag');
});

test('an embed greeting wins and is never replaced', async () => {
  const { resolve } = await loadResolver();
  const p = resolve(envelope({ greetingMessage: 'Hi! I am the Support Agent.', greetingIsDefault: true }), { greetingMessage: 'Bonjour de notre site' }).persona;
  assert.equal(p.greetingMessage, 'Bonjour de notre site');
  assert.equal(p.greetingIsDefault, false);
});

test('the default greeting is translated, English for other languages', async () => {
  const { makeT } = await loadResolver();
  assert.equal(makeT('uk-UA')('widget.greeting'), 'Вітаю! Чим можу допомогти?');
  assert.equal(makeT('de')('widget.greeting'), 'Hallo! Wie kann ich Ihnen heute helfen?');
  assert.equal(makeT('fr-CA')('widget.greeting'), 'Bonjour ! Comment puis-je vous aider aujourd’hui ?');
  assert.equal(makeT('az')('widget.greeting'), 'Hi there! What can I help you with today?');
});
