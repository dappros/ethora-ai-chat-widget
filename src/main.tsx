import React from 'react';
import ReactDOM from 'react-dom/client';
import AssistantTest from './AssistantTest.tsx';
import './index.css';
import {
  provisionWidgetSession,
  WidgetSessionEnvelope,
  __widgetSessionStorage,
} from './utils/provisionWidgetSession';

// Storage keys we own and clear when the embed identity changes (different
// app, different visitor). The visitor record itself lives at
// __widgetSessionStorage.KEY and is cleared by clearStorageForNewApp below.
const APP_ID_STORAGE_KEY = 'ethora-widget-app-id';
const PERSIST_ROOT_KEY = 'persist:root';
const PERSIST_CHAT_SETTINGS_KEY = 'persist:chatSettingStore';
const PERSIST_ROOMS_KEY = 'persist:roomMessages';
const PERSIST_ASSISTANT_SLICE_KEY = 'persist:assistanRoomSlice';
const PERSIST_ROOM_HEAP_KEY = 'persist:roomHeapSlice';
const ASSISTANT_USER_KEY = 'ethora-assistant-user';
const ASSISTANT_MESSAGES_KEY = 'ethora-assistant-messages';
const ASSISTANT_TIMESTAMP_KEY = 'ethora-assistant-timestamp';
const ASSISTANT_OPEN_STATE_KEYS = ['EthoraAssistantOpen', 'assistantChatOpen'];

// Wipe per-conversation state when the embed binds to a different app on
// the same browser. Different app = different bot, different rooms, no
// continuity expected.
function clearStorageForNewApp(newAppId?: string) {
  if (!newAppId) return;
  const previousAppId = window.localStorage.getItem(APP_ID_STORAGE_KEY);
  if (previousAppId && previousAppId === newAppId) return;

  try {
    window.localStorage.removeItem(ASSISTANT_USER_KEY);
    window.localStorage.removeItem(ASSISTANT_MESSAGES_KEY);
    window.localStorage.removeItem(ASSISTANT_TIMESTAMP_KEY);
    ASSISTANT_OPEN_STATE_KEYS.forEach((k) => window.localStorage.removeItem(k));

    window.localStorage.removeItem(PERSIST_ROOT_KEY);
    window.localStorage.removeItem(PERSIST_CHAT_SETTINGS_KEY);
    window.localStorage.removeItem(PERSIST_ROOMS_KEY);
    window.localStorage.removeItem(PERSIST_ASSISTANT_SLICE_KEY);
    window.localStorage.removeItem(PERSIST_ROOM_HEAP_KEY);
    __widgetSessionStorage.clear();
  } catch (e) {
    console.warn('[ethora-widget] Failed to clear storage on app change', e);
  }

  window.localStorage.setItem(APP_ID_STORAGE_KEY, newAppId);
}

// Per-embed overrides pulled from <script> tag attributes. Every field
// is optional — missing means "use the default" which is either the
// active Agent's value (for displayName/avatar/greeting) or a generic
// platform fallback (for greetingTitle).
interface EmbedOverrides {
  botName?: string;
  botAvatar?: string;
  title?: string;
  greetingTitle?: string;
  greeting?: string;
}

function mountChatAssistant(
  container: HTMLElement,
  envelope: WidgetSessionEnvelope,
  apiBase: string,
  overrides: EmbedOverrides
) {
  ReactDOM.createRoot(container).render(
    <AssistantTest envelope={envelope} apiBase={apiBase} overrides={overrides} />
  );
}

function mountErrorState(container: HTMLElement, message: string) {
  // Minimal inert placeholder so the embedding page sees something rather
  // than nothing if provisioning failed (network, AI not configured, etc).
  // Embedded as a small pill, not a chat — operators get a clear failure
  // signal in the console too.
  const node = document.createElement('div');
  node.setAttribute('role', 'status');
  node.style.cssText = [
    'position:fixed',
    'right:24px',
    'bottom:24px',
    'padding:8px 12px',
    'border-radius:8px',
    'background:#fff3cd',
    'color:#664d03',
    'font:12px/1.4 system-ui, sans-serif',
    'box-shadow:0 2px 8px rgba(0,0,0,0.12)',
    'max-width:320px',
    'z-index:2147483647',
  ].join(';');
  node.textContent = message;
  container.appendChild(node);
}

function createChatWidgetDiv(): HTMLDivElement {
  const chatWidgetContainer = document.createElement('div');
  chatWidgetContainer.id = 'chat-widget';
  return chatWidgetContainer;
}

// Derive the install's API base from the script tag's `src` URL when not
// explicitly given. Convention: a deploy that hosts `assistant.js` at
// `https://widget.foo.example.com/assistant.js` runs its API at
// `https://api.foo.example.com`. So we replace the leading "widget." label
// with "api.". Operators with non-standard layouts pass `data-api-base`
// explicitly.
function deriveApiBase(scriptTag: HTMLElement | null): string | undefined {
  if (!scriptTag) return undefined;
  // `data-api-url` is the legacy attribute name shipped by the WordPress
  // plugin's bundled embed. Accepted as an alias so pre-2.0 plugin
  // installs keep working when the rebuilt bundle is dropped in.
  const explicit =
    scriptTag.getAttribute('data-api-base') ||
    scriptTag.getAttribute('data-api-url');
  if (explicit) return explicit;
  const src = (scriptTag as HTMLScriptElement).src || '';
  if (!src) return undefined;
  try {
    const u = new URL(src);
    const host = u.host.replace(/^widget\./, 'api.');
    return `${u.protocol}//${host}`;
  } catch {
    return undefined;
  }
}

let bootstrapAttempts = 0;
const BOOTSTRAP_MAX_ATTEMPTS = 200; // ~2s at 10ms intervals

async function bootstrap() {
  if (!document.body) {
    setTimeout(bootstrap, 10);
    return;
  }

  const existing = document.getElementById('chat-widget');
  if (existing) return;

  // Some embedding hosts (notably the WordPress plugin pre-v1.7.x) inject the
  // chat-content-assistant config tag via a separate inline script that runs
  // *after* this bundle is loaded. The bundle script tag appears earlier in
  // document order, so on first call the config tag may not exist yet. Poll
  // briefly before giving up.
  const scriptTag = document.getElementById('chat-content-assistant');
  if (!scriptTag) {
    bootstrapAttempts += 1;
    if (bootstrapAttempts < BOOTSTRAP_MAX_ATTEMPTS) {
      setTimeout(bootstrap, 10);
      return;
    }
    // eslint-disable-next-line no-console
    console.error(
      '[ethora-widget] no #chat-content-assistant tag found after polling; embed cannot start.'
    );
    return;
  }

  let appId = scriptTag?.getAttribute('data-app-id') || undefined;
  const apiBase = deriveApiBase(scriptTag);

  // Legacy fallback: the WordPress plugin's settings field stores a bot
  // JID of the form `${appId}_${userId}-bot@${xmppHost}`. The leading
  // underscore-delimited segment is always the app ID (App IDs are
  // 24-char Mongo ObjectId hex and never contain underscores), so
  // parsing it out lets pre-2.0 plugin installs keep working without a
  // PHP-side settings migration when the rebuilt bundle is dropped in.
  if (!appId) {
    const legacyBotId = scriptTag?.getAttribute('data-bot-id') || '';
    const candidate = legacyBotId.split('_')[0];
    if (candidate) appId = candidate;
  }

  if (!appId || !apiBase) {
    // eslint-disable-next-line no-console
    console.error(
      '[ethora-widget] missing data-app-id (or legacy data-bot-id) and/or data-api-base; embed cannot start.',
      { appId, apiBase }
    );
    return;
  }

  // Read all per-embed overrides up-front. `data-bot-display-name` is
  // an alias for `data-bot-name` kept for back-compat with operators
  // running snippets generated before the param rename.
  const stripUndef = (v: string | null) => (v && v.length ? v : undefined);
  const overrides: EmbedOverrides = {
    botName:
      stripUndef(scriptTag?.getAttribute('data-bot-name') || null) ||
      stripUndef(scriptTag?.getAttribute('data-bot-display-name') || null),
    botAvatar: stripUndef(scriptTag?.getAttribute('data-bot-avatar') || null),
    title: stripUndef(scriptTag?.getAttribute('data-title') || null),
    greetingTitle: stripUndef(
      scriptTag?.getAttribute('data-greeting-title') || null
    ),
    greeting: stripUndef(scriptTag?.getAttribute('data-greeting') || null),
  };

  clearStorageForNewApp(appId);

  const chatWidgetContainer = createChatWidgetDiv();
  document.body.appendChild(chatWidgetContainer);

  let envelope: WidgetSessionEnvelope;
  try {
    envelope = await provisionWidgetSession({ appId, apiBase });
  } catch (e: any) {
    const code = e?.code;
    let userMessage = 'Chat is temporarily unavailable.';
    if (code === 'AI_BOT_NOT_CONFIGURED') {
      userMessage = 'AI assistant is not configured for this site yet.';
    } else if (code === 'APP_NOT_FOUND') {
      userMessage = 'Chat configuration error: app not recognised.';
    }
    // eslint-disable-next-line no-console
    console.error('[ethora-widget] session provisioning failed:', e);
    mountErrorState(chatWidgetContainer, userMessage);
    return;
  }

  mountChatAssistant(chatWidgetContainer, envelope, apiBase, overrides);
}

bootstrap();
