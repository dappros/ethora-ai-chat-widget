import ReactDOM from 'react-dom/client';
// chat-component ships its (small) static stylesheet separately from the JS,
// and its styled-components (bundled inside its dist) inject the rest into
// <head> at runtime. We add the static sheet to <head> here so the chat is
// fully styled. NOTE: this widget intentionally does NOT use a Shadow DOM in
// this build, because @ethora/chat-component's dist bundles its own
// styled-components instance whose <style> tags cannot be retargeted into a
// shadow root from here. Restoring full host-page style isolation requires
// consuming chat-component from source (so styled-components dedupes to a
// single instance and a StyleSheetManager can target the shadow) — tracked
// as a follow-up.
import chatComponentCss from '@ethora/chat-component/dist/main.css?inline';
import Assistant from './Assistant';
import {
  provisionWidgetSession,
  WidgetSessionEnvelope,
  __widgetSessionStorage,
} from './utils/provisionWidgetSession';
import type { EmbedOverrides } from './widget/resolveSession';
import { VITE_APP_API_URL } from './config';

// Storage keys we own and clear when the embed identity changes (different
// app -> different bot/rooms, no continuity expected).
const APP_ID_STORAGE_KEY = 'ethora-widget-app-id';
const PERSIST_KEYS = [
  'persist:root',
  'persist:chatSettingStore',
  'persist:roomMessages',
  'persist:assistanRoomSlice',
  'persist:roomHeapSlice',
];
const OPEN_STATE_KEYS = ['EthoraAssistantOpen', 'assistantChatOpen'];
const STATIC_STYLE_ID = 'ethora-widget-chat-css';

function clearStorageForNewApp(newAppId?: string) {
  if (!newAppId) return;
  let previousAppId: string | null = null;
  try {
    previousAppId = window.localStorage.getItem(APP_ID_STORAGE_KEY);
  } catch {
    return;
  }
  if (previousAppId && previousAppId === newAppId) return;

  try {
    OPEN_STATE_KEYS.forEach((k) => window.localStorage.removeItem(k));
    PERSIST_KEYS.forEach((k) => window.localStorage.removeItem(k));
    __widgetSessionStorage.clear();
    window.localStorage.setItem(APP_ID_STORAGE_KEY, newAppId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[ethora-widget] Failed to clear storage on app change', e);
  }
}

// Resolve the install's API base. Precedence: explicit data-api-base /
// data-api-url -> derived from the script `src` (widget.* -> api.*) ->
// Ethora Cloud default.
function resolveApiBase(scriptTag: HTMLElement | null): string {
  const explicit =
    scriptTag?.getAttribute('data-api-base')?.trim() ||
    scriptTag?.getAttribute('data-api-url')?.trim();
  if (explicit) return explicit;

  const src = (scriptTag as HTMLScriptElement | null)?.src || '';
  if (src) {
    try {
      const u = new URL(src);
      const host = u.host.replace(/^widget\./, 'api.');
      return `${u.protocol}//${host}`;
    } catch {
      // fall through to default
    }
  }
  return VITE_APP_API_URL;
}

function injectChatStyles() {
  if (document.getElementById(STATIC_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STATIC_STYLE_ID;
  style.textContent = chatComponentCss as unknown as string;
  document.head.appendChild(style);
}

function mountErrorState(message: string) {
  // Minimal inert pill so the embedding page sees a clear failure signal
  // rather than nothing if provisioning fails (network / AI not configured).
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
  document.body.appendChild(node);
}

function readOverrides(scriptTag: HTMLElement | null): EmbedOverrides {
  const get = (name: string) => {
    const v = scriptTag?.getAttribute(name);
    return v && v.length ? v : undefined;
  };
  return {
    // data-bot-display-name kept as a back-compat alias for data-bot-name.
    botName: get('data-bot-name') || get('data-bot-display-name'),
    botAvatar: get('data-bot-avatar'),
    title: get('data-title'),
    greetingTitle: get('data-greeting-title'),
    greeting: get('data-greeting'),
  };
}

async function bootstrap() {
  if (!document.body) {
    setTimeout(bootstrap, 10);
    return;
  }
  if (document.getElementById('chat-widget')) return;

  const scriptTag = document.getElementById('chat-content-assistant');
  const appId = scriptTag?.getAttribute('data-app-id')?.trim() || undefined;
  const apiBase = resolveApiBase(scriptTag);

  if (!appId) {
    // eslint-disable-next-line no-console
    console.error(
      '[ethora-widget] missing data-app-id on the embed <script id="chat-content-assistant">; widget cannot start.'
    );
    return;
  }

  const overrides = readOverrides(scriptTag);
  clearStorageForNewApp(appId);
  injectChatStyles();

  const container = document.createElement('div');
  container.id = 'chat-widget';
  document.body.appendChild(container);

  let envelope: WidgetSessionEnvelope;
  try {
    envelope = await provisionWidgetSession({ appId, apiBase });
  } catch (e: any) {
    const code = e?.code;
    let message = 'Chat is temporarily unavailable.';
    if (code === 'AI_BOT_NOT_CONFIGURED') {
      message = 'AI assistant is not configured for this site yet.';
    } else if (code === 'APP_NOT_FOUND') {
      message = 'Chat configuration error: app not recognised.';
    }
    // eslint-disable-next-line no-console
    console.error('[ethora-widget] session provisioning failed:', e);
    mountErrorState(message);
    return;
  }

  ReactDOM.createRoot(container).render(
    <Assistant envelope={envelope} apiBase={apiBase} overrides={overrides} />
  );
}

bootstrap();
