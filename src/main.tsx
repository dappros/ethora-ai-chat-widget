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
import { readAppearance } from './widget/appearance';
import {
  installPublicApi,
  registerTeardown,
} from './widget/publicApi';
import { ETHORA_CHAT_ASSISTANT_VERSION } from './version';
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
  '@ethora/chat-component-user-session',
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
  // Same app is NOT enough to skip the wipe. The visitor identity and the
  // cached rooms map are written independently, so they can disagree: a host
  // that clears only the visitor (the admin preview used to) leaves a rooms
  // map pointing at rooms that no longer exist, and the chat then fires MAM
  // history requests at them - the "Conference room does not exist" noise.
  // Treat that mismatch as a reason to wipe, regardless of the app id.
  let inconsistent = false;
  try {
    const hasVisitor = !!window.localStorage.getItem('ethora-widget-visitor');
    const hasRooms =
      !!window.localStorage.getItem('persist:rooms') ||
      !!window.localStorage.getItem('persist:roomMessages');
    inconsistent = hasRooms && !hasVisitor;
  } catch {
    // storage unreadable; fall through to the app-id comparison
  }

  // ALWAYS wipe the engine's persisted state, same app or not. The server
  // mints a NEW room on every /v2/widget/sessions call (verified against
  // production), so a rehydrated rooms map can only ever point at rooms from
  // previous sessions - and rehydrating it is exactly what left resumed
  // visitors stuck on "Connecting…" while first-time visitors worked. Only
  // the visitor identity (ethora-widget-visitor) is worth keeping across
  // loads, and it is not in these lists.
  void previousAppId;
  void inconsistent;

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

function readOverrides(get: (name: string) => string | undefined): EmbedOverrides {
  return {
    // data-bot-display-name kept as a back-compat alias for data-bot-name.
    botName: get('data-bot-name') || get('data-bot-display-name'),
    botAvatar: get('data-bot-avatar'),
    title: get('data-title'),
    greetingTitle: get('data-greeting-title'),
    greeting: get('data-greeting'),
    greetingMessage: get('data-greeting-message'),
    // System messages ("X has joined") are hidden by default; opt back in
    // with data-hide-system-messages="false".
    hideSystemMessages: get('data-hide-system-messages') !== 'false',
  };
}

// Cosmetic config getter: a URL query param (`ethora-<name>`) overrides the
// embed `data-<name>` attribute, so the look can be tuned per-link without
// editing the page. Restricted to cosmetic/appearance keys - appId / apiBase /
// botId are intentionally NOT URL-overridable (a URL must never repoint the
// widget at a different bot or backend).
function makeCosmeticGetter(scriptTag: HTMLElement | null) {
  let url: URLSearchParams;
  try {
    url = new URLSearchParams(window.location.search);
  } catch {
    url = new URLSearchParams();
  }
  return (dataAttr: string): string | undefined => {
    const fromUrl = url.get('ethora-' + dataAttr.replace(/^data-/, ''));
    if (fromUrl != null && fromUrl.length) return fromUrl;
    const v = scriptTag?.getAttribute(dataAttr);
    return v && v.length ? v : undefined;
  };
}

async function bootstrap() {
  if (!document.body) {
    setTimeout(bootstrap, 10);
    return;
  }
  // Installed before anything can fail, so a host can always call reset()
  // even when provisioning never succeeds.
  installPublicApi(ETHORA_CHAT_ASSISTANT_VERSION);

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

  const cosmeticGet = makeCosmeticGetter(scriptTag);
  const overrides = readOverrides(cosmeticGet);
  const appearance = readAppearance(cosmeticGet);
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
    // resumeXmppUsername: null = mint a fresh visitor every load. Resume is
    // deliberately OFF: the server creates a NEW room on every session call,
    // so resuming the visitor identity gives no conversation continuity - it
    // only exercised an engine path that came up blank (header, no messages,
    // no empty state) while first visits worked end to end. When the server
    // learns to return the SAME room for a resumed visitor, flip this back
    // to reading the persisted identity.
    envelope = await provisionWidgetSession({
      appId,
      apiBase,
      resumeXmppUsername: null,
    });
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

  const reactRoot = ReactDOM.createRoot(appRoot);
  registerTeardown(() => {
    reactRoot.unmount();
    host.remove();
  });
  reactRoot.render(
    // Pin chat-component's (single-instance) styled-components into the shadow.
    <StyleSheetManager target={shadow as unknown as HTMLElement}>
      <Assistant
        envelope={envelope}
        apiBase={apiBase}
        overrides={overrides}
        appearance={appearance}
      />
    </StyleSheetManager>
  );
}

bootstrap();
