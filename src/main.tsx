import ReactDOM from 'react-dom/client';
import { StyleSheetManager } from 'styled-components';
// chat-component's static base stylesheet, pulled in as a string and injected
// into the widget's Shadow DOM (not the host <head>), so the host page is
// never restyled. The component's runtime styled-components are pinned into
// the same shadow root via <StyleSheetManager target>. Because we build
// chat-component from SOURCE, there is ONE styled-components instance, so this
// retarget actually captures every style the chat emits.
import chatComponentCss from '@ethora/chat-component/index.css?inline';
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
  'persist:rooms',
  'persist:assistanRoomSlice',
  'persist:roomHeapSlice',
  '@ethora/chat-component-cache-scope',
];
const OPEN_STATE_KEYS = ['EthoraAssistantOpen', 'assistantChatOpen'];

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

// Resolve the appId for the widget-session call. Precedence:
//   1. explicit data-app-id (the new-arch contract)
//   2. data-bot-id fallback (back-compat with the existing WP plugin, which
//      ships a bot JID): an Ethora bot JID is `${appId}_<botUser>-bot@host`,
//      so the appId is the local-part prefix before the first underscore.
function resolveAppId(scriptTag: HTMLElement | null): string | undefined {
  const explicit = scriptTag?.getAttribute('data-app-id')?.trim();
  if (explicit) return explicit;

  const botId = scriptTag?.getAttribute('data-bot-id')?.trim();
  if (botId) {
    const localPart = botId.split('@')[0];
    if (localPart.includes('_')) {
      const prefix = localPart.split('_')[0];
      if (prefix) return prefix;
    }
  }
  return undefined;
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
    // System messages ("X has joined") are hidden by default; opt back in
    // with data-hide-system-messages="false".
    hideSystemMessages:
      scriptTag?.getAttribute('data-hide-system-messages') !== 'false',
  };
}

async function bootstrap() {
  if (!document.body) {
    setTimeout(bootstrap, 10);
    return;
  }
  if (document.getElementById('chat-widget')) return;

  const scriptTag = document.getElementById('chat-content-assistant');
  const appId = resolveAppId(scriptTag);
  const apiBase = resolveApiBase(scriptTag);

  if (!appId) {
    // eslint-disable-next-line no-console
    console.error(
      '[ethora-widget] missing data-app-id (or a data-bot-id to derive it from) on the embed <script id="chat-content-assistant">; widget cannot start.'
    );
    return;
  }

  const overrides = readOverrides(scriptTag);
  clearStorageForNewApp(appId);

  // Host element + Shadow DOM: the entire widget renders inside the shadow
  // root, so neither the host page's CSS reaches the chat nor the chat's CSS
  // reaches the host page.
  const host = document.createElement('div');
  host.id = 'chat-widget';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  // chat-component's static CSS, scoped to the shadow root.
  const staticStyle = document.createElement('style');
  staticStyle.textContent = chatComponentCss as unknown as string;
  shadow.appendChild(staticStyle);

  // React mount point inside the shadow.
  const appRoot = document.createElement('div');
  shadow.appendChild(appRoot);

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

  ReactDOM.createRoot(appRoot).render(
    // Pin chat-component's (single-instance) styled-components into the shadow.
    <StyleSheetManager target={shadow as unknown as HTMLElement}>
      <Assistant envelope={envelope} apiBase={apiBase} overrides={overrides} />
    </StyleSheetManager>
  );
}

bootstrap();
