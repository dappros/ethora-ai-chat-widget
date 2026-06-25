import React, { useEffect, useMemo, useState } from 'react';
import { XmppProvider, Chat } from '@ethora/chat-component';
import { WidgetSessionEnvelope } from './utils/provisionWidgetSession';
import { resolveSession, EmbedOverrides } from './widget/resolveSession';
import { registerWidgetRoom } from './widget/registerWidgetRoom';
import { Appearance } from './widget/appearance';

// Persisted open/closed state so a page navigation keeps the panel as the
// visitor left it. Kept as the same key the legacy widget used.
const OPEN_STATE_KEY = 'EthoraAssistantOpen';
const Z = 2147483000;

// Rendered in place of MUC system messages to suppress them (see config).
const HiddenSystemMessage = () => null;

interface AssistantProps {
  envelope: WidgetSessionEnvelope;
  apiBase: string;
  overrides?: EmbedOverrides;
  appearance: Appearance;
}

/**
 * The embeddable AI assistant widget.
 *
 * This is a thin single-bot shell around `@ethora/chat-component`: it owns
 * the floating launcher button + popup chrome (the widget's identity), and
 * renders the full chat engine inside the popup, configured to connect as the
 * pre-provisioned visitor and join exactly one MUC room.
 *
 * The chat tree is mounted lazily on first open and then kept mounted (the
 * panel is hidden via CSS, not unmounted) so the XMPP connection persists and
 * messages keep arriving while the panel is closed.
 *
 * Look & feel (colors, fonts, bubble/input backgrounds, dock side, size) come
 * from the `appearance` prop, which the embed reads off the `<script>` data-*
 * attributes; theme colors/fonts are forwarded into chat-component's config.
 */
export default function Assistant({
  envelope,
  apiBase,
  overrides,
  appearance,
}: AssistantProps) {
  const session = useMemo(
    () => resolveSession(envelope, overrides),
    [envelope, overrides]
  );
  const { user, roomJID, xmppSettings, persona } = session;
  // System messages ("X has joined the chat") are hidden by default.
  const hideSystemMessages = overrides?.hideSystemMessages !== false;

  const [open, setOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(OPEN_STATE_KEY) === '1';
    } catch {
      return false;
    }
  });
  // Once opened, keep the chat engine mounted (visibility toggles, no remount).
  const [hasMounted, setHasMounted] = useState<boolean>(open);

  useEffect(() => {
    if (open) setHasMounted(true);
    try {
      window.localStorage.setItem(OPEN_STATE_KEY, open ? '1' : '0');
    } catch {
      // ignore (storage disabled)
    }
  }, [open]);

  // Register the known MUC room directly in chat-component's store once the
  // chat engine has mounted (so it runs after redux-persist rehydration and
  // is not clobbered). The widget visitor has no API token and the room-list
  // IQ doesn't surface widget rooms, so without this the chat shows "No room".
  useEffect(() => {
    if (hasMounted) registerWidgetRoom(session);
  }, [hasMounted, session]);

  // appId is the prefix of the server-issued visitor username
  // (`${appId}_widget-<uuid>`); surfaced to chat-component for completeness.
  const appId = useMemo(
    () => (user.xmppUsername.includes('_') ? user.xmppUsername.split('_')[0] : ''),
    [user.xmppUsername]
  );

  // Resolve the applied font: an explicit family wins, else the Google family.
  const fontFamily = appearance.fontFamily || appearance.googleFont;

  // The chat-component config. The single-room recipe for 26.5.x:
  //   userLogin.user (xmpp creds)  -> connect as visitor, no login form
  //   defaultRooms                 -> force-join the one MUC over XMPP
  //   roomJID prop                 -> select it as the active room
  //   disableRooms + chatHeaderSettings.hide -> render only the conversation
  //   fallbackScreens.noUser       -> never flash the built-in login form
  //   colors / typography          -> per-embed theming (appearance)
  const config = useMemo(
    () => ({
      appId,
      baseUrl: apiBase,
      userLogin: { enabled: true, user },
      xmppSettings,
      defaultRooms: [{ jid: roomJID, pinned: true }],
      newArch: false,
      disableRooms: true,
      disableHeader: true,
      disableRoomMenu: true,
      // No message reactions / context menu in the assistant. Also lets the
      // build stub out the emoji picker + dataset (see vite.config aliases).
      disableInteractions: true,
      // Hide MUC join/leave system messages (rendering a null component for
      // them). chat-component shows the custom component when no whitelist is
      // set, so this suppresses every system message.
      ...(hideSystemMessages ? { customSystemMessage: HiddenSystemMessage } : {}),
      botMessageAutoScroll: true,
      colors: {
        primary: appearance.primaryColor,
        secondary: appearance.secondaryColor,
        ...(appearance.iconsColor ? { icons: appearance.iconsColor } : {}),
        ...(appearance.ownBubbleBg
          ? { ownMessageBackground: appearance.ownBubbleBg }
          : {}),
        ...(appearance.otherBubbleBg
          ? { otherMessageBackground: appearance.otherBubbleBg }
          : {}),
        ...(appearance.inputBg ? { inputBackground: appearance.inputBg } : {}),
      },
      ...(fontFamily || appearance.fontSize
        ? {
            typography: {
              ...(fontFamily ? { fontFamily } : {}),
              ...(appearance.fontSize ? { fontSize: appearance.fontSize } : {}),
              ...(appearance.googleFont
                ? { googleFontsFamily: appearance.googleFont }
                : {}),
            },
          }
        : {}),
      chatHeaderSettings: { hide: true, disableCreate: true, hideSearch: true },
      // The assistant always has a known room (we self-inject it), so the
      // built-in "No room. Let's create one!" screen must NEVER show. Replace
      // every empty/disconnected state with a status screen: a "connecting"
      // spinner while it settles, or a "no internet" placard when offline.
      fallbackScreens: {
        noUser: <StatusScreen color={appearance.primaryColor} mode="connecting" />,
        noRoom: <StatusScreen color={appearance.primaryColor} mode="connecting" />,
        noConnection: (
          <StatusScreen color={appearance.primaryColor} mode="reconnecting" />
        ),
      },
    }),
    [appId, apiBase, user, xmppSettings, roomJID, hideSystemMessages, appearance, fontFamily]
  );

  // Chrome styles (live inside the Shadow DOM). Driven by appearance.
  const primary = appearance.primaryColor;
  const dockSide = appearance.position === 'left' ? { left: 24 } : { right: 24 };

  const launcherStyle: React.CSSProperties = {
    width: 60,
    height: 60,
    borderRadius: '50%',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    background: primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 24px rgba(0,0,0,0.24)',
  };

  const panelStyle: React.CSSProperties = {
    flexDirection: 'column',
    width: `min(${appearance.width}px, calc(100vw - 32px))`,
    height: `min(${appearance.height}px, calc(100vh - 48px))`,
    background: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
    ...(fontFamily ? { fontFamily } : {}),
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '12px 14px',
    background: primary,
    color: '#fff',
    flex: '0 0 auto',
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, zIndex: Z, ...dockSide }}>
      {/* Launcher button (hidden while the panel is open) */}
      {!open && (
        <button
          type="button"
          aria-label={`Open ${persona.title}`}
          onClick={() => setOpen(true)}
          style={launcherStyle}
        >
          {persona.botAvatar ? (
            <img
              src={persona.botAvatar}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <ChatGlyph />
          )}
        </button>
      )}

      {/* Popup panel: mounted on first open, then hidden (not unmounted). */}
      {hasMounted && (
        <div
          role="dialog"
          aria-label={persona.title}
          style={{ ...panelStyle, display: open ? 'flex' : 'none' }}
        >
          <header style={headerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={avatarStyle}>
                {persona.botAvatar ? (
                  <img
                    src={persona.botAvatar}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  persona.title.slice(0, 1).toUpperCase()
                )}
              </span>
              <span style={titleStyle}>{persona.title}</span>
            </div>
            <button
              type="button"
              aria-label="Close assistant chat"
              onClick={() => setOpen(false)}
              style={closeStyle}
            >
              <CloseGlyph />
            </button>
          </header>

          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <XmppProvider config={config}>
              <Chat
                user={{ email: '', password: '' }}
                roomJID={roomJID}
                config={config}
                MainComponentStyles={{ height: '100%' }}
              />
            </XmppProvider>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- static chrome styles (color-independent) --- */

const avatarStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  overflow: 'hidden',
  background: 'rgba(255,255,255,0.25)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: 15,
  flex: '0 0 auto',
};

const titleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 15,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const closeStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#fff',
  cursor: 'pointer',
  padding: 4,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
};

const ChatGlyph = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Z"
      fill="currentColor"
    />
  </svg>
);

const CloseGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6 6 18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// Shown instead of the built-in "No room" / "No connection" screens. Online ->
// a "connecting"/"reconnecting" spinner; offline -> a "no internet" placard.
function StatusScreen({
  color,
  mode,
}: {
  color: string;
  mode: 'connecting' | 'reconnecting';
}) {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const wrap: React.CSSProperties = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    textAlign: 'center',
    color: '#475569',
  };

  if (!online) {
    return (
      <div style={wrap}>
        <OfflineGlyph />
        <div style={{ fontWeight: 600, fontSize: 15, color: '#0f172a' }}>
          No internet connection
        </div>
        <div style={{ fontSize: 13 }}>
          Check your connection - the chat will reconnect automatically.
        </div>
      </div>
    );
  }
  return (
    <div style={wrap}>
      <Spinner color={color} />
      <div style={{ fontSize: 13 }}>
        {mode === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
      </div>
    </div>
  );
}

const Spinner = ({ color }: { color: string }) => (
  <svg width="34" height="34" viewBox="0 0 50 50" aria-hidden="true">
    <circle
      cx="25"
      cy="25"
      r="20"
      fill="none"
      stroke={color}
      strokeWidth="5"
      strokeLinecap="round"
      strokeDasharray="80 50"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 25 25"
        to="360 25 25"
        dur="0.9s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

const OfflineGlyph = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M2 2l20 20" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
    <path
      d="M5 12.5a10 10 0 0 1 4-2.6M12 5c2.6 0 5 .9 6.9 2.5M8.5 16a5 5 0 0 1 3-1.5M12 20h.01"
      stroke="#94a3b8"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
