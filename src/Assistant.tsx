import React, { useEffect, useMemo, useState } from 'react';
import { XmppProvider, Chat } from '@ethora/chat-component';
import { WidgetSessionEnvelope } from './utils/provisionWidgetSession';
import { resolveSession, EmbedOverrides } from './widget/resolveSession';
import { registerWidgetRoom } from './widget/registerWidgetRoom';
import { registerGreeting } from './widget/registerGreeting';
import { Appearance } from './widget/appearance';
// Deep source imports (the vite alias maps `@ethora/chat-component/<x>` onto
// the sibling repo's `src/<x>`), so the widget reuses the engine's own art and
// icons instead of shipping near-duplicates that drift from it.
import { NoMessagesIllustration } from '@ethora/chat-component/assets/illustrations/NoMessagesIllustration';

// Persisted open/closed state so a page navigation keeps the panel as the
// visitor left it. Kept as the same key the legacy widget used.
const OPEN_STATE_KEY = 'EthoraAssistantOpen';
const EXPANDED_STATE_KEY = 'EthoraAssistantExpanded';
const CTA_DISMISSED_KEY = 'EthoraAssistantCtaDismissed';
const Z = 2147483000;

// The shipped widget's launcher gradient, kept as the default so an embed that
// sets nothing looks like the CDN build rather than like a flat blue disc.
const DEFAULT_GRADIENT_FROM = '#6e72fc';
const DEFAULT_GRADIENT_TO = '#ad1deb';
/** How long the teaser stays up once shown. Matches the original 5s. */
const CTA_VISIBLE_MS = 5000;

/**
 * chat-component publishes its font on `--ethora-font-family`, but its default
 * lives in an `index.css` rule scoped to `body` - and the widget renders inside
 * a Shadow DOM, where that rule matches nothing. The chrome then fell back to
 * whatever the host page uses while the chat internals used their own stack, so
 * the two disagreed (most visibly on the avatar initials). Pinning the same
 * stack on the widget root makes chrome and chat render as one UI.
 */
const DEFAULT_FONT_STACK =
  "var(--ethora-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif)";

/**
 * UI language for the chat captions.
 *
 * Without an explicit value chat-component resolves captions from `langSource`,
 * which is the reader's own picked language and is PERSISTED. One stray click
 * on the in-chat globe (or a leftover value from a previous session) therefore
 * left the widget stuck in that language forever, on every site, which is how a
 * widget on an English page ended up rendering Spanish.
 *
 * A support widget should follow the page it is embedded on, so: explicit
 * `data-locale` wins, else the host document's `lang`, else the browser, else
 * English.
 */
function resolveUiLocale(explicit?: string): string {
  const pick = (v?: string | null) => (v && v.trim() ? v.trim() : undefined);
  if (pick(explicit)) return explicit!.trim();
  try {
    const htmlLang = pick(document.documentElement.getAttribute('lang'));
    if (htmlLang) return htmlLang;
    const nav = pick(navigator.language);
    if (nav) return nav;
  } catch {
    // SSR / locked-down env, fall through
  }
  return 'en';
}

/**
 * Keyframes for the launcher glow and the teaser's fade/bounce. These have to
 * be real CSS (inline styles cannot express keyframes) and are injected into
 * the widget's Shadow DOM, so they cannot leak into the host page.
 * `--ethora-glow-*` is set per-instance from the resolved gradient.
 */
const CHROME_KEYFRAMES = `
@keyframes ethora-pulse-glow {
  0%   { box-shadow: 0 0 12px var(--ethora-glow-soft); }
  50%  { box-shadow: 0 0 20px var(--ethora-glow-strong); }
  100% { box-shadow: 0 0 12px var(--ethora-glow-soft); }
}
@keyframes ethora-fade-bounce {
  0%   { opacity: 0; transform: translateY(-3px); }
  10%  { opacity: 1; transform: translateY(-1px); }
  50%  { opacity: 1; transform: translateY(1px); }
  90%  { opacity: 1; transform: translateY(3px); }
  100% { opacity: 1; transform: translateY(1px); }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes ethora-pulse-glow { 0%,100% { box-shadow: 0 0 12px var(--ethora-glow-soft); } }
  @keyframes ethora-fade-bounce { 0%,100% { opacity: 1; transform: none; } }
}
`;

/**
 * Resolve a configured length against the VIEWPORT rather than the parent.
 *
 * The panel is `position: fixed` inside a wrapper whose height is `auto`, so a
 * plain `40%` height has no definite containing block to resolve against and
 * collapses the panel to nothing. An embedder writing `data-height="40%"`
 * means "40% of the screen", so translate percentages to `vw`/`vh`. Every
 * other unit is already absolute or viewport-relative and passes through.
 */
function toViewportLength(len: string, axis: 'w' | 'h'): string {
  const t = (len || '').trim();
  const m = /^(-?\d+(?:\.\d+)?)%$/.exec(t);
  if (!m) return t;
  return `${m[1]}${axis === 'w' ? 'vw' : 'vh'}`;
}

/**
 * Add an alpha channel to a hex colour so it can be used as a glow. Non-hex
 * inputs (named colours, rgb(), gradients someone pasted in) are returned
 * unchanged: the shadow then just renders opaque instead of breaking.
 */
function withAlpha(color: string, alpha: number): string {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

  // Starter bubble, once the room exists in the store. Deferred a tick so it
  // runs after registerWidgetRoom's dispatch has flushed, otherwise there is
  // no room to attach it to and it is silently dropped.
  useEffect(() => {
    if (!hasMounted || !persona.greetingMessage) return;
    const t = setTimeout(() => {
      registerGreeting({
        roomJID,
        text: persona.greetingMessage,
        botXmppUsername: persona.botXmppUsername,
        botName: persona.botName,
        botAvatar: persona.botAvatar,
      });
    }, 0);
    return () => clearTimeout(t);
  }, [hasMounted, roomJID, persona]);

  // appId is the prefix of the server-issued visitor username
  // (`${appId}_widget-<uuid>`); surfaced to chat-component for completeness.
  const appId = useMemo(
    () => (user.xmppUsername.includes('_') ? user.xmppUsername.split('_')[0] : ''),
    [user.xmppUsername]
  );

  // Resolve the applied font: an explicit family wins, else the Google family,
  // else the shared stack so chrome and chat never disagree.
  const fontFamily =
    appearance.fontFamily || appearance.googleFont || DEFAULT_FONT_STACK;
  const uiLocale = useMemo(
    () => resolveUiLocale(appearance.locale),
    [appearance.locale]
  );

  // Panel expanded to (near) fullscreen. Persisted so it survives navigation.
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(EXPANDED_STATE_KEY);
      if (saved !== null) return saved === '1';
    } catch {
      // ignore
    }
    return appearance.startFullscreen;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(EXPANDED_STATE_KEY, expanded ? '1' : '0');
    } catch {
      // ignore
    }
  }, [expanded]);

  // Teaser pill next to the closed launcher. Shown once per browser: a nudge
  // that reappears on every page view is an annoyance, and someone who has
  // already opened the chat does not need to be invited again.
  const [ctaDismissed, setCtaDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(CTA_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [ctaReady, setCtaReady] = useState(false);
  // Appear after the delay, then retire itself 5s later, matching the original
  // widget. A teaser that stays up forever becomes furniture people stop
  // seeing, and it covers the page.
  useEffect(() => {
    if (open || ctaDismissed || !appearance.ctaText) return;
    const show = setTimeout(() => setCtaReady(true), appearance.ctaDelay);
    const hide = setTimeout(
      () => setCtaReady(false),
      appearance.ctaDelay + CTA_VISIBLE_MS
    );
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [open, ctaDismissed, appearance.ctaText, appearance.ctaDelay]);
  // Opening the chat retires the teaser for good.
  useEffect(() => {
    if (!open) return;
    setCtaReady(false);
    setCtaDismissed(true);
    try {
      window.localStorage.setItem(CTA_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
  }, [open]);
  const showCta = !open && ctaReady && !ctaDismissed && !!appearance.ctaText;

  // Empty-state placeholder handed to the engine as `noMessagesPlaceholder`.
  // Identity must be stable or the engine remounts it on every render, so it
  // is memoised on the copy + colour it actually renders.
  const EmptyState = useMemo(() => {
    const { greetingTitle, greeting } = persona;
    const color = appearance.primaryColor;
    // Reuses chat-component's own NoMessagesIllustration so the widget's empty
    // state matches the shipped one. The built-in placeholder is not usable as
    // is: its copy ("This chat is empty / Be the first one to start it") is
    // hardcoded and wrong for a single-bot assistant, so we render the same
    // illustration with the persona's greeting copy around it.
    const Placeholder = () => (
      <div style={emptyStateStyle}>
        <NoMessagesIllustration width={200} style={{ color }} />
        <div style={emptyCopyStyle}>
          <div style={emptyTitleStyle}>{greetingTitle}</div>
          {greeting ? <div style={emptyBodyStyle}>{greeting}</div> : null}
        </div>
      </div>
    );
    Placeholder.displayName = 'AssistantEmptyState';
    return Placeholder;
  }, [persona, appearance.primaryColor]);

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
      // Text-only composer when the embed asks for it: hides attach + mic.
      disableMedia: appearance.disableMedia,
      // Empty-state copy. Without this the panel renders blank on a fresh
      // conversation: the greeting was resolved into `persona` and then never
      // handed to the engine.
      noMessagesPlaceholder: EmptyState,
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
      // Pin the caption language so a persisted `langSource` cannot hijack it.
      i18n: { locale: uiLocale },
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
    [
      appId,
      apiBase,
      user,
      xmppSettings,
      roomJID,
      hideSystemMessages,
      appearance,
      fontFamily,
      EmptyState,
      uiLocale,
    ]
  );

  // Chrome styles (live inside the Shadow DOM). Driven by appearance.
  const primary = appearance.primaryColor;
  const dockSide = appearance.position === 'left' ? { left: 24 } : { right: 24 };

  // Launcher: gradient + coloured glow when configured, otherwise the flat
  // primary. The glow is a second, wider shadow tinted with the end colour so
  // the button reads as a light source rather than a flat disc.
  // Restored from the original AssistantClosedButton: violet gradient with a
  // pulsing glow keyed to the gradient's end colour. Defaults are the shipped
  // widget's exact values (#6e72fc -> #ad1deb); data-launcher-gradient and
  // data-primary-color only override them.
  const [gradFrom, gradTo] = appearance.launcherGradient || [
    DEFAULT_GRADIENT_FROM,
    DEFAULT_GRADIENT_TO,
  ];
  const usesBrandFlat = !appearance.launcherGradient && appearance.flatLauncher;
  const launcherBg = usesBrandFlat
    ? primary
    : `linear-gradient(135deg, ${gradFrom}, ${gradTo})`;
  const glowColor = usesBrandFlat ? primary : gradTo;
  const launcherSize = appearance.launcherSize;

  const launcherStyle: React.CSSProperties = {
    width: launcherSize,
    height: launcherSize,
    borderRadius: '50%',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    background: launcherBg,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 12px ${withAlpha(glowColor, 0.4)}`,
    transition: 'transform 0.2s ease',
    flex: '0 0 auto',
    ...(appearance.launcherGlow
      ? { animation: `ethora-pulse-glow 2.5s infinite` }
      : {}),
  };

  // Expanded mode escapes the docked box: the panel is taken out of the
  // bottom-corner anchor and pinned to the viewport with a small inset, so it
  // works the same whether the widget docks left or right.
  const isExpanded = appearance.allowFullscreen && expanded;

  // Percentages must resolve against the viewport, not the auto-height wrapper.
  const dockedW = toViewportLength(appearance.width, 'w');
  const dockedH = toViewportLength(appearance.height, 'h');
  const expandedW = toViewportLength(appearance.expandedWidth, 'w');
  const expandedH = toViewportLength(appearance.expandedHeight, 'h');
  const inset = toViewportLength(appearance.expandedInset, 'w');
  // `0px` inset means the user asked for a genuinely full screen, so drop the
  // rounding and the drop shadow too: a rounded, shadowed rectangle pinned to
  // all four edges reads as a broken modal, not as fullscreen.
  const isEdgeToEdge = /^0(px|%|vw|vh|rem|em)?$/.test(inset.trim());

  const panelStyle: React.CSSProperties = isExpanded
    ? {
        flexDirection: 'column',
        position: 'fixed',
        // Centred within the inset box, so a partial expanded size (say 80%)
        // sits in the middle of the screen rather than hugging one corner.
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `min(${expandedW}, calc(100vw - 2 * ${inset}))`,
        height: `min(${expandedH}, calc(100vh - 2 * ${inset}))`,
        background: '#fff',
        borderRadius: isEdgeToEdge ? 0 : 16,
        overflow: 'hidden',
        boxShadow: isEdgeToEdge ? 'none' : '0 12px 40px rgba(0,0,0,0.22)',
        ...(fontFamily ? { fontFamily } : {}),
      }
    : {
        flexDirection: 'column',
        // 32/48px keep the docked panel clear of the viewport edges and the
        // launcher on small screens; a % width is clamped by the same rule.
        width: `min(${dockedW}, calc(100vw - 32px))`,
        height: `min(${dockedH}, calc(100vh - 48px))`,
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
    <div
      style={
        {
          position: 'fixed',
          bottom: 24,
          zIndex: Z,
          fontFamily,
          ...dockSide,
          // Consumed by the ethora-pulse-glow keyframes.
          '--ethora-glow-soft': withAlpha(glowColor, 0.4),
          '--ethora-glow-strong': withAlpha(glowColor, 0.8),
        } as unknown as React.CSSProperties
      }
    >
      {/* Scoped to the widget's Shadow DOM, never reaches the host page. */}
      <style>{CHROME_KEYFRAMES}</style>

      {/* Launcher button (hidden while the panel is open) */}
      {!open && (
        <>
          {showCta && (
            // Teaser sits ABOVE the launcher, as in the original widget. It is
            // a button rather than decoration: people click the copy at least
            // as often as the circle, and an inert pill beside a live one
            // reads as broken.
            <button
              type="button"
              onClick={() => setOpen(true)}
              style={{
                ...ctaStyle,
                bottom: launcherSize + 26,
                ...(appearance.position === 'left'
                  ? { left: 0 }
                  : { right: 0 }),
                ...(fontFamily ? { fontFamily } : {}),
              }}
            >
              {appearance.ctaSparkle ? '✨ ' : ''}
              {appearance.ctaText}
            </button>
          )}
        <button
          type="button"
          aria-label={`Open ${persona.title}`}
          onClick={() => setOpen(true)}
          style={launcherStyle}
        >
          {appearance.launcherIcon ? (
            // data-launcher-icon wins: it themes ONLY the launcher, and is
            // padded rather than cover-cropped so a flat glyph reads correctly
            // on the coloured circle.
            <img
              src={appearance.launcherIcon}
              alt=""
              style={{ width: '58%', height: '58%', objectFit: 'contain' }}
            />
          ) : persona.botAvatar ? (
            <img
              src={persona.botAvatar}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <ChatGlyph size={Math.round(launcherSize * 0.57)} />
          )}
        </button>
        </>
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
            <div style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
              {appearance.allowFullscreen && (
                <button
                  type="button"
                  aria-label={isExpanded ? 'Collapse assistant chat' : 'Expand assistant chat'}
                  title={isExpanded ? 'Collapse' : 'Expand'}
                  onClick={() => setExpanded((v) => !v)}
                  style={closeStyle}
                >
                  {isExpanded ? <CollapseGlyph /> : <ExpandGlyph />}
                </button>
              )}
              <button
                type="button"
                aria-label="Close assistant chat"
                onClick={() => setOpen(false)}
                style={closeStyle}
              >
                <CloseGlyph />
              </button>
            </div>
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

// Original ChatTooltip: white pill floating above the launcher.
const ctaStyle: React.CSSProperties = {
  position: 'absolute',
  background: '#ffffff',
  color: '#333',
  padding: '10px 14px',
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
  fontSize: 14,
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  // Long copy must not push the pill off a narrow viewport.
  maxWidth: 'calc(100vw - 64px)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  cursor: 'pointer',
  animation: 'ethora-fade-bounce 5s ease forwards',
};

// Mirrors chat-component's own NoMessagesPlaceholder layout (illustration,
// 16px gap, centred copy block) so the two read as the same screen.
const emptyStateStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: '16px 20px',
  textAlign: 'center',
  boxSizing: 'border-box',
};

const emptyCopyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 16,
  justifyContent: 'center',
  textAlign: 'center',
};

const emptyTitleStyle: React.CSSProperties = {
  fontSize: 'var(--ethora-font-size, 16px)',
  fontWeight: 600,
};

const emptyBodyStyle: React.CSSProperties = {
  fontSize: 'var(--ethora-font-size-sm, 14px)',
  fontWeight: 400,
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

/**
 * The original widget's launcher mark (`AiChatIcon` from the pre-new-arch
 * `assets/icons.tsx`, dropped in 8accc85 with the vendored engine): two
 * four-point sparkles over an outlined speech bubble. Restored verbatim rather
 * than redrawn, so the launcher matches the shipped CDN widget exactly.
 */
const ChatGlyph = ({ size = 32 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 100 100"
    aria-hidden="true"
  >
    <g fill="currentColor">
      <path d="M59.0611877,20.9756413c0,0.8509388-0.4599991,1.6099339-1.1959724,2.0238914l-10.4183121,5.7037582L41.743145,39.1216011c-0.3909378,0.7359734-1.1729507,1.1959724-2.0008698,1.1959724c-0.8509369,0-1.6099319-0.4599991-2.0238914-1.1959724l-5.7036171-10.4183102l-10.3954296-5.7037582c-0.7589931-0.4139576-1.1958332-1.1729527-1.1958332-2.0238914c0-0.8279171,0.4368401-1.6097927,1.1958332-2.0008698l10.3954296-5.7036171l5.7036171-10.4184513c0.8050385-1.4718062,3.2428856-1.4718062,4.0247612,0l5.7037582,10.4184513l10.4183121,5.7036171C58.6011887,19.3658485,59.0611877,20.1477242,59.0611877,20.9756413z" />
      <path d="M68.7665482,52.4148827c0,0.8509369-0.4599991,1.6097908-1.1958389,2.0238914l-7.1985817,3.9326744l-3.9328194,7.2216072c-0.4139557,0.7359772-1.1959724,1.1959763-2.0238914,1.1959763c-0.8509369,0-1.6099319-0.4599991-2.0238914-1.1959763l-3.9328156-7.2216072l-7.2214661-3.9326744c-0.7359734-0.4141006-1.1959724-1.1729546-1.1959724-2.0238914c0-0.8280602,0.4599991-1.6099319,1.1959724-2.0008698l7.2214661-3.9558411l3.9328156-7.1985855c0.8050385-1.4719467,3.2428894-1.4719467,4.0477829,0l3.9328194,7.1985855l7.1985817,3.9558411C68.3065491,50.8049507,68.7665482,51.5868225,68.7665482,52.4148827z" />
      <path d="M21.1944294,98.251152c-0.3144341,0-0.631115-0.0651321-0.9320736-0.1976471c-0.8310051-0.3683395-1.3677902-1.1926041-1.3677902-2.1022186V80.4227142c-5.0983305-1.0645828-8.9389238-5.5946884-8.9389238-11.0029602V40.2065392c0-6.1966057,5.042182-11.2387867,11.2387877-11.2387867h4.9680653c1.2712135,0,2.2998638,1.0286503,2.2998638,2.2998638s-1.0286503,2.2998657-2.2998638,2.2998657h-4.9680653c-3.6609154,0-6.63906,2.9781418-6.63906,6.6390572V69.419754c0,3.6609116,2.9781446,6.639061,6.63906,6.639061c1.2712135,0,2.2998638,1.0286484,2.2998638,2.2998581v12.3977051l15.5353127-14.1001434c0.4222374-0.3840561,0.9747467-0.5974197,1.5452194-0.5974197h38.2307472c3.6609116,0,6.639061-2.9781494,6.639061-6.639061V40.2065392c0-3.6609154-2.9781494-6.6390572-6.639061-6.6390572H53.7586136c-1.2712135,0-2.2998619-1.0286522-2.2998619-2.2998657s1.0286484-2.2998638,2.2998619-2.2998638h25.0469589c6.1966019,0,11.2387848,5.042181,11.2387848,11.2387867V69.419754c0,6.1966019-5.0421829,11.2387848-11.2387848,11.2387848H41.4619789L22.7396507,97.6537247C22.3084259,98.0467682,21.7559204,98.251152,21.1944294,98.251152z" />
    </g>
  </svg>
);

/**
 * Header expand / collapse marks, restored from the widget's own
 * `assets/icons.tsx` (deleted in 8accc85). Rounded-square outline with an
 * arrow, matching the shipped CDN widget rather than a redrawn equivalent.
 */
const ExpandGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M13.5 10.5H16.5M13.5 10.5V7.5M13.5 10.5L17 7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.5 13.5H7.5M10.5 13.5V16.5M10.5 13.5L7 17"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C21.5093 4.43821 21.8356 5.80655 21.9449 8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const CollapseGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M10.5 13.5H7.5M10.5 13.5V16.5M10.5 13.5L7 17"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 10.5H16.5M13.5 10.5V7.5M13.5 10.5L17 7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C21.5093 4.43821 21.8356 5.80655 21.9449 8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
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
