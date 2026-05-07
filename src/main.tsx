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

function mountChatAssistant(
  container: HTMLElement,
  envelope: WidgetSessionEnvelope,
  apiBase: string
) {
  ReactDOM.createRoot(container).render(
    <AssistantTest envelope={envelope} apiBase={apiBase} />
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
  const explicit = scriptTag.getAttribute('data-api-base');
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

async function bootstrap() {
  if (!document.body) {
    setTimeout(bootstrap, 10);
    return;
  }

  const existing = document.getElementById('chat-widget');
  if (existing) return;

  const scriptTag = document.getElementById('chat-content-assistant');
  const appId = scriptTag?.getAttribute('data-app-id') || undefined;
  const apiBase = deriveApiBase(scriptTag);

  if (!appId || !apiBase) {
    // eslint-disable-next-line no-console
    console.error(
      '[ethora-widget] missing data-app-id or data-api-base; embed cannot start.',
      { appId, apiBase }
    );
    return;
  }

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

  mountChatAssistant(chatWidgetContainer, envelope, apiBase);
}

bootstrap();
