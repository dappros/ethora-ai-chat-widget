import React, { useEffect, useMemo, useRef, useState } from 'react';
import { XmppProvider, Chat } from '@ethora/chat-component';
import { WidgetSessionEnvelope } from './utils/provisionWidgetSession';
import { resolveSession, EmbedOverrides } from './widget/resolveSession';
import { registerWidgetRoom } from './widget/registerWidgetRoom';
import { registerGreeting } from './widget/registerGreeting';
import { store as chatStore } from '@ethora/chat-component/roomStore';
import { Appearance } from './widget/appearance';
import { quickRepliesCss, attachQuickReplyLayout } from './widget/quickReplies';
import { CHROME_CSS } from './widget/chromeCss';
import { WidgetTypingBubble } from './widget/typingBubble';
import {
  WIDGET_LANGUAGES,
  DEFAULT_COPY,
  makeT,
  matchLanguage,
} from './widget/i18n';
import { setLangSource } from '@ethora/chat-component/roomStore/chatSettingsSlice';

// Persisted open/closed state so a page navigation keeps the panel as the
// visitor left it. Kept as the same key the legacy widget used.
const OPEN_STATE_KEY = 'EthoraAssistantOpen';
const EXPANDED_STATE_KEY = 'EthoraAssistantExpanded';
const CTA_DISMISSED_KEY = 'EthoraAssistantCtaDismissed';
const LOCALE_KEY = 'EthoraAssistantLocale';
const SIZE_KEY = 'EthoraAssistantSize';
const MIN_W = 320;
const MIN_H = 400;
const Z = 2147483000;

// The shipped widget's launcher gradient, kept as the default so an embed that
// sets nothing looks like the CDN build rather than like a flat blue disc.
const DEFAULT_GRADIENT_FROM = '#6e72fc';
const DEFAULT_GRADIENT_TO = '#ad1deb';
/** How long the teaser stays up once shown. Matches the original 5s. */
const CTA_VISIBLE_MS = 5000;
/** Length of the panel's close animation (see .ew-panel.ew-closing). */
const CLOSE_MS = 170;

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

/** The scheme the chrome paints in: "system" follows the visitor's OS setting. */
function useResolvedScheme(pref: Appearance['colorScheme']): 'light' | 'dark' {
  const query = '(prefers-color-scheme: dark)';
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (pref !== 'system') return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(query);
    } catch {
      return;
    }
    const sync = () => setSystemDark(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [pref]);
  if (pref === 'dark') return 'dark';
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return 'light';
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
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
 * The chrome itself is styled by widget/chromeCss.ts.
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
  // The panel plays its close animation before it is hidden.
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const launcherRef = useRef<HTMLButtonElement>(null);
  // Set when the visitor closes the panel, so focus can return to the launcher
  // (a hidden panel would otherwise drop keyboard focus onto the page body).
  const returnFocusOnClose = useRef(false);

  useEffect(() => {
    if (open) setHasMounted(true);
    try {
      window.localStorage.setItem(OPEN_STATE_KEY, open ? '1' : '0');
    } catch {
      // ignore (storage disabled)
    }
    if (!open && returnFocusOnClose.current) {
      returnFocusOnClose.current = false;
      launcherRef.current?.focus();
    }
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    []
  );

  const closePanel = () => {
    if (closing || !open) return;
    returnFocusOnClose.current = true;
    if (prefersReducedMotion()) {
      setOpen(false);
      return;
    }
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, CLOSE_MS);
  };

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
    const timer = setTimeout(() => {
      registerGreeting({
        roomJID,
        text:
          persona.greetingMessage === DEFAULT_COPY.greeting
            ? makeT(uiLocale)('widget.greeting')
            : persona.greetingMessage,
        botXmppUsername: persona.botXmppUsername,
        botName: persona.botName,
        botAvatar: persona.botAvatar,
      });
    }, 0);
    return () => clearTimeout(timer);
    // uiLocale deliberately not a dependency: the starter bubble is posted once
    // per room, in the language the reader had when the chat opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted, roomJID, persona]);

  // When neither the embed nor the Agent named the bot, the header must not
  // sit on the generic fallback while the bot's own replies carry its real
  // name. registerWidgetRoom adopts that name into the store from the bot's
  // first message; mirror it here.
  const [learnedBotName, setLearnedBotName] = useState('');
  useEffect(() => {
    if (persona.botNameExplicit || !persona.botXmppUsername) return;
    const read = () => {
      const entry = (chatStore.getState() as any)?.rooms?.usersSet?.[
        persona.botXmppUsername
      ];
      const name = entry
        ? `${entry.firstName || ''} ${entry.lastName || ''}`.trim()
        : '';
      setLearnedBotName((prev) => (prev === name ? prev : name));
    };
    read();
    return chatStore.subscribe(read);
  }, [persona.botNameExplicit, persona.botXmppUsername]);
  const headerTitle =
    persona.titleExplicit || persona.botNameExplicit
      ? persona.title
      : learnedBotName || persona.title;

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
  // Reader's own pick from the header globe wins over data-locale / <html lang>
  // and is remembered, since choosing a language is a deliberate act.
  const [pickedLocale, setPickedLocale] = useState<string | undefined>(() => {
    if (!appearance.languageSelector) return undefined;
    try {
      return matchLanguage(window.localStorage.getItem(LOCALE_KEY)) || undefined;
    } catch {
      return undefined;
    }
  });
  const uiLocale = useMemo(
    () => pickedLocale || resolveUiLocale(appearance.locale),
    [pickedLocale, appearance.locale]
  );
  const t = useMemo(() => makeT(uiLocale), [uiLocale]);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const pickLanguage = (id: string) => {
    setPickedLocale(id);
    setLangMenuOpen(false);
    try {
      window.localStorage.setItem(LOCALE_KEY, id);
    } catch {
      // ignore
    }
    // Same switch the component's own globe makes: captions and the reader's
    // translation language move together.
    chatStore.dispatch(setLangSource(id as any));
  };

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
  const ctaLabel =
    appearance.ctaText === DEFAULT_COPY.cta ? t('widget.cta') : appearance.ctaText;

  // Empty-state placeholder handed to the engine as `noMessagesPlaceholder`.
  // Identity must be stable or the engine remounts it on every render, so it
  // is memoised on the copy it actually renders.
  const EmptyState = useMemo(() => {
    const greetingTitle =
      persona.greetingTitle === DEFAULT_COPY.emptyTitle
        ? t('widget.emptyTitle')
        : persona.greetingTitle;
    const greeting =
      persona.greeting === `Our ${persona.botName} will be happy to help`
        ? t('widget.emptyBody', { name: persona.botName })
        : persona.greeting;
    // The built-in placeholder is not usable as is: its copy is hardcoded and
    // wrong for a single-bot assistant, so the widget renders its own empty
    // state with the persona's copy, styled by the .ew-empty rules.
    const Placeholder = () => (
      <div className="ew-empty">
        <div className="ew-empty-orb" aria-hidden="true">
          <ChatGlyph size={34} />
        </div>
        <div className="ew-empty-title">{greetingTitle}</div>
        {greeting ? <div className="ew-empty-body">{greeting}</div> : null}
      </div>
    );
    Placeholder.displayName = 'AssistantEmptyState';
    return Placeholder;
  }, [persona, t]);

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
      // A single-bot conversation has no profiles worth opening: clicking the
      // bot's avatar must do nothing (it used to open an empty profile card).
      disableProfilesInteractions: true,
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
      // Typing indicator: a soft bubble with a wave of dots (widget/typingBubble.tsx).
      customTypingIndicator: {
        enabled: true,
        position: 'bottom',
        customComponent: WidgetTypingBubble,
      },
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
      colorScheme: appearance.colorScheme,
      // Profile / room-update events are honoured only from the bot itself, so
      // a visitor in the room cannot forge them. The room list and message
      // search are not part of a single-bot widget.
      ...(persona.botXmppUsername
        ? { trustedEventSenders: [persona.botXmppUsername] }
        : {}),
      disablePublicChatsDirectory: true,
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
      persona.botXmppUsername,
    ]
  );

  const scheme = useResolvedScheme(appearance.colorScheme);
  const primary = appearance.primaryColor;
  const dockSide = appearance.position === 'left' ? { left: 24 } : { right: 24 };

  // Quick-reply buttons inside the chat are restyled from here (see
  // widget/quickReplies.ts). The root element is the observation point: the
  // chat mounts inside it, so new bot button rows are caught as they arrive.
  const rootRef = useRef<HTMLDivElement>(null);
  // Grow the composer's textarea with its content. Listens on the widget root,
  // so it needs no hook into the engine; Enter is covered too, because sending
  // clears the field without firing an input event.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fit = (target: EventTarget | null) => {
      if (!(target instanceof HTMLTextAreaElement)) return;
      requestAnimationFrame(() => {
        target.style.height = 'auto';
        // Two lines or more: the text hugs the field (2px above and below),
        // one line keeps the roomier padding. Measured from the content, so
        // switching the padding never changes the answer.
        const cs = window.getComputedStyle(target);
        const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const lineH = parseFloat(cs.lineHeight) || 20;
        const lines = Math.round((target.scrollHeight - padY) / lineH);
        if (lines >= 2) target.setAttribute('data-multiline', '');
        else target.removeAttribute('data-multiline');
        target.style.height = 'auto';
        target.style.height = `${Math.min(target.scrollHeight, 140)}px`;
      });
    };
    const onEvent = (e: Event) => fit(e.target);
    root.addEventListener('input', onEvent);
    root.addEventListener('keyup', onEvent);
    // The engine renders the textarea with rows=2. With an auto height that
    // would make the EMPTY field two lines tall, so pin it to one row as soon
    // as it mounts and size it from there.
    const pinRows = () => {
      root.querySelectorAll('textarea').forEach((t) => {
        if (t.rows !== 1) {
          t.rows = 1;
          fit(t);
        }
      });
    };
    const mo = new MutationObserver(pinRows);
    mo.observe(root, { childList: true, subtree: true });
    pinRows();
    return () => {
      mo.disconnect();
      root.removeEventListener('input', onEvent);
      root.removeEventListener('keyup', onEvent);
    };
  }, []);
  useEffect(() => {
    if (!rootRef.current) return;
    return attachQuickReplyLayout(rootRef.current);
  }, []);

  // Launcher: gradient + coloured glow when configured, otherwise the flat
  // primary. The glow is a second, wider shadow tinted with the end colour so
  // the button reads as a light source rather than a flat disc.
  // Defaults are the shipped widget's exact values (#6e72fc -> #ad1deb);
  // data-launcher-gradient and data-primary-color only override them.
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

  // Expanded mode escapes the docked box: the panel is taken out of the
  // bottom-corner anchor and pinned to the viewport with a small inset, so it
  // works the same whether the widget docks left or right.
  // Reader-resizable docked panel: drag the corner that faces into the page
  // (top-left when docked right, top-right when docked left). The size is
  // remembered; double-click the grip to go back to the default.
  const panelRef = useRef<HTMLDivElement>(null);
  const [customSize, setCustomSize] = useState<{ w: number; h: number } | null>(() => {
    try {
      const raw = window.localStorage.getItem(SIZE_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      return typeof v?.w === 'number' && typeof v?.h === 'number' ? v : null;
    } catch {
      return null;
    }
  });
  const dockedLeft = appearance.position === 'left';
  // `edge` says which borders the handle moves: the left/right border changes
  // width only, the top border height only, the corner both.
  const startResize = (edge: 'x' | 'y' | 'xy') => (e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    e.preventDefault();
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    const rect = panel.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
    let last = { w: rect.width, h: rect.height };
    const move = (ev: PointerEvent) => {
      const dx = dockedLeft ? ev.clientX - sx : sx - ev.clientX;
      const dy = sy - ev.clientY;
      last = {
        w: edge === 'y' ? rect.width : Math.round(clamp(rect.width + dx, MIN_W, window.innerWidth - 32)),
        h: edge === 'x' ? rect.height : Math.round(clamp(rect.height + dy, MIN_H, window.innerHeight - 48)),
      };
      setCustomSize(last);
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      try {
        window.localStorage.setItem(SIZE_KEY, JSON.stringify(last));
      } catch {
        // ignore
      }
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  };
  const resetSize = () => {
    setCustomSize(null);
    try {
      window.localStorage.removeItem(SIZE_KEY);
    } catch {
      // ignore
    }
  };

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

  // Only the geometry is inline. Surface, radius and shadow come from the
  // .ew-panel class so the palette stays in one place.
  const panelStyle: React.CSSProperties = isExpanded
    ? {
        position: 'fixed',
        // Centred within the inset box, so a partial expanded size (say 80%)
        // sits in the middle of the screen rather than hugging one corner.
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `min(${expandedW}, calc(100vw - 2 * ${inset}))`,
        height: `min(${expandedH}, calc(100vh - 2 * ${inset}))`,
        ...(isEdgeToEdge ? { borderRadius: 0, boxShadow: 'none' } : {}),
      }
    : {
        // 32/48px keep the docked panel clear of the viewport edges and the
        // launcher on small screens; a % width is clamped by the same rule.
        width: `min(${customSize ? `${customSize.w}px` : dockedW}, calc(100vw - 32px))`,
        height: `min(${customSize ? `${customSize.h}px` : dockedH}, calc(100vh - 48px))`,
      };

  const glowRing = `color-mix(in srgb, ${glowColor} 18%, transparent)`;
  const glowSoft = `color-mix(in srgb, ${glowColor} 36%, transparent)`;
  const glowStrong = `color-mix(in srgb, ${glowColor} 60%, transparent)`;

  const panelVisible = open || closing;

  return (
    <div
      ref={rootRef}
      className={appearance.position === 'left' ? 'ew-root ew-dock-left' : 'ew-root'}
      data-ew-scheme={scheme}
      style={
        {
          position: 'fixed',
          bottom: 24,
          zIndex: Z,
          fontFamily,
          ...dockSide,
          '--ew-primary': primary,
          '--ew-glow-ring': glowRing,
          '--ew-glow-soft': glowSoft,
          '--ew-glow-strong': glowStrong,
          // Accent for the typing bubble and the quick-reply buttons.
          '--ethora-qr-accent': primary,
        } as unknown as React.CSSProperties
      }
    >
      {/* Scoped to the widget's Shadow DOM, never reaches the host page. */}
      <style>{CHROME_CSS}</style>
      <style>{quickRepliesCss(appearance.buttonStyle)}</style>

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
              className="ew-teaser"
              onClick={() => setOpen(true)}
              style={{
                bottom: launcherSize + 26,
                ...(appearance.position === 'left' ? { left: 0 } : { right: 0 }),
                fontFamily,
              }}
            >
              {appearance.ctaSparkle ? <span className="ew-teaser-spark" aria-hidden="true" /> : null}
              {ctaLabel}
            </button>
          )}
          <button
            ref={launcherRef}
            type="button"
            className={appearance.launcherGlow ? 'ew-launcher ew-launcher--glow' : 'ew-launcher'}
            aria-label={t('widget.open', { name: headerTitle })}
            onClick={() => setOpen(true)}
            style={{
              width: launcherSize,
              height: launcherSize,
              borderRadius: '50%',
              background: launcherBg,
            }}
          >
            {/* The widget's icon is its own setting (data-launcher-icon), never
                the bot's avatar: the avatar belongs to the bot's messages, and
                borrowing it made a person's photo the site's chat button.
                Padded and contained, not cover-cropped, so a flat glyph reads
                correctly on the coloured circle. */}
            {appearance.launcherIcon ? (
              <img
                src={appearance.launcherIcon}
                alt=""
                style={{ width: '58%', height: '58%', objectFit: 'contain' }}
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
          ref={panelRef}
          role="dialog"
          aria-label={headerTitle}
          className={[
            'ew-panel',
            closing ? 'ew-closing' : '',
            isExpanded ? 'ew-expanded' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closePanel();
          }}
          style={{ ...panelStyle, display: panelVisible ? 'flex' : 'none' }}
        >
          {!isExpanded && (
            <>
              <div
                className={`ew-edge${dockedLeft ? ' ew-edge--right' : ''}`}
                title={t('widget.resize')}
                onPointerDown={startResize('xy')}
                onDoubleClick={resetSize}
              />
            </>
          )}
          <header className="ew-header">
            <div className="ew-brand">
              <span
                className={appearance.launcherIcon ? 'ew-avatar ew-avatar--icon' : 'ew-avatar'}
                aria-hidden="true"
              >
                {appearance.launcherIcon ? (
                  <img src={appearance.launcherIcon} alt="" />
                ) : (
                  headerTitle.slice(0, 1).toUpperCase()
                )}
              </span>
              <div className="ew-titles">
                <span className="ew-title">{headerTitle}</span>
              </div>
            </div>
            <div className="ew-actions">
              {appearance.languageSelector && (
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <button
                    type="button"
                    className="ew-iconbtn"
                    aria-label={t('language.select')}
                    title={t('language.select')}
                    aria-haspopup="listbox"
                    aria-expanded={langMenuOpen}
                    onClick={() => setLangMenuOpen((v) => !v)}
                  >
                    <GlobeGlyph />
                  </button>
                  {langMenuOpen && (
                    <>
                      <div
                        onClick={() => setLangMenuOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 1 }}
                      />
                      <div role="listbox" className="ew-menu">
                        {WIDGET_LANGUAGES.map((l) => {
                          const selected = matchLanguage(uiLocale) === l.id;
                          return (
                            <button
                              key={l.id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              className="ew-menu-item"
                              onClick={() => pickLanguage(l.id)}
                            >
                              {l.name}
                              {selected ? <CheckGlyph /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
              {appearance.allowFullscreen && (
                <button
                  type="button"
                  className="ew-iconbtn ew-iconbtn--expand"
                  aria-label={isExpanded ? t('widget.collapse') : t('widget.expand')}
                  title={isExpanded ? t('widget.collapse') : t('widget.expand')}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {isExpanded ? <CollapseGlyph /> : <ExpandGlyph />}
                </button>
              )}
              <button
                type="button"
                className="ew-iconbtn"
                aria-label={t('widget.close')}
                onClick={closePanel}
              >
                <CloseGlyph />
              </button>
            </div>
          </header>

          <div className="ew-body">
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

/* --- icons --- */

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

const GlobeGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M2.5 10h15M10 2.5c2 2.1 3 4.7 3 7.5s-1 5.4-3 7.5c-2-2.1-3-4.7-3-7.5s1-5.4 3-7.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const CheckGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 12.5l4.5 4.5L19 7.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Header expand / collapse marks, restored from the widget's own
 * `assets/icons.tsx` (deleted in 8accc85). Rounded-square outline with an
 * arrow, matching the shipped CDN widget rather than a redrawn equivalent.
 */
const ExpandGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CollapseGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20 10h-6V4M14 10l7-7M4 14h6v6M10 14l-7 7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CloseGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

  if (!online) {
    return (
      <div className="ew-status">
        <OfflineGlyph />
        <div className="ew-status-title">No internet connection</div>
        <div>Check your connection, the chat will reconnect automatically.</div>
      </div>
    );
  }
  return (
    <div className="ew-status">
      <Spinner color={color} />
      <div>{mode === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</div>
    </div>
  );
}

const Spinner = ({ color }: { color: string }) => (
  <svg width="30" height="30" viewBox="0 0 50 50" aria-hidden="true">
    <circle
      cx="25"
      cy="25"
      r="20"
      fill="none"
      stroke={color}
      strokeWidth="4"
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
