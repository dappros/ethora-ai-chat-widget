import React, { useEffect, useMemo, useState } from 'react';
import { XmppProvider, Chat } from '@ethora/chat-component';
import { WidgetSessionEnvelope } from './utils/provisionWidgetSession';
import { resolveSession, EmbedOverrides } from './widget/resolveSession';

// Persisted open/closed state so a page navigation keeps the panel as the
// visitor left it. Kept as the same key the legacy widget used.
const OPEN_STATE_KEY = 'EthoraAssistantOpen';

// Brand defaults. Overridable per-embed later via data-* if needed.
const PRIMARY = '#1976d2';
const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 560;
const Z = 2147483000;

interface AssistantProps {
  envelope: WidgetSessionEnvelope;
  apiBase: string;
  overrides?: EmbedOverrides;
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
 */
export default function Assistant({
  envelope,
  apiBase,
  overrides,
}: AssistantProps) {
  const { user, roomJID, xmppSettings, persona } = useMemo(
    () => resolveSession(envelope, overrides),
    [envelope, overrides]
  );

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

  // appId is the prefix of the server-issued visitor username
  // (`${appId}_widget-<uuid>`); surfaced to chat-component for completeness.
  const appId = useMemo(
    () => (user.xmppUsername.includes('_') ? user.xmppUsername.split('_')[0] : ''),
    [user.xmppUsername]
  );

  // The chat-component config. The single-room recipe for 26.5.x:
  //   userLogin.user (xmpp creds)  -> connect as visitor, no login form
  //   defaultRooms                 -> force-join the one MUC over XMPP
  //   roomJID prop                 -> select it as the active room
  //   disableRooms + chatHeaderSettings.hide -> render only the conversation
  //   fallbackScreens.noUser       -> never flash the built-in login form
  const config = useMemo(
    () => ({
      appId,
      baseUrl: apiBase,
      userLogin: { enabled: true, user },
      xmppSettings,
      defaultRooms: [{ jid: roomJID, pinned: true }],
      disableRooms: true,
      disableHeader: true,
      disableRoomMenu: true,
      botMessageAutoScroll: true,
      colors: { primary: PRIMARY, secondary: '#E1E4FE' },
      chatHeaderSettings: { hide: true, disableCreate: true, hideSearch: true },
      fallbackScreens: {
        noUser: <div style={{ padding: 16 }} />,
      },
    }),
    [appId, apiBase, user, xmppSettings, roomJID]
  );

  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: Z }}>
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

/* --- inline styles (work inside the Shadow DOM the widget mounts into) --- */

const launcherStyle: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: '50%',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  overflow: 'hidden',
  background: PRIMARY,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 6px 24px rgba(0,0,0,0.24)',
};

const panelStyle: React.CSSProperties = {
  flexDirection: 'column',
  width: `min(${PANEL_WIDTH}px, calc(100vw - 32px))`,
  height: `min(${PANEL_HEIGHT}px, calc(100vh - 48px))`,
  background: '#fff',
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '12px 14px',
  background: PRIMARY,
  color: '#fff',
  flex: '0 0 auto',
};

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
