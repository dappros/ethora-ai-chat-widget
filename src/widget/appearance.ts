// Visual customization read from the embed <script> data-* attributes.
// Theme colors / bubbles / input map onto chat-component's IConfig.colors,
// fonts onto IConfig.typography, and position/size onto the widget's own
// launcher + popup chrome.

export interface Appearance {
  /** Header + launcher color, and chat primary. Default #1976d2. */
  primaryColor: string;
  /** Chat secondary color. Default #E1E4FE. */
  secondaryColor: string;
  /** Chat icon color (attach/send/mic). Falls back to primary in the engine. */
  iconsColor?: string;
  /** Background of the visitor's own message bubbles. */
  ownBubbleBg?: string;
  /** Background of the bot's message bubbles. */
  otherBubbleBg?: string;
  /** Background of the message input bar. */
  inputBg?: string;
  /** Font family applied to the chat (and the chrome). */
  fontFamily?: string;
  /** Base font size, e.g. "16", "1.1rem". */
  fontSize?: string;
  /** Google Fonts family name to auto-load (e.g. "Inter"). */
  googleFont?: string;
  /**
   * BCP-47 tag for the chat's UI captions, e.g. "en", "uk", "fr-CA". When
   * unset the widget follows the host page's <html lang>, then the browser.
   * Pinning this stops a persisted reader language from leaking across
   * sessions and sites.
   */
  locale?: string;
  /** Which side the launcher/popup dock to. Default "right". */
  position: 'left' | 'right';
  /**
   * Popup width as a CSS length. A bare number means px; `%`, `px`, `vw`,
   * `vh`, `rem`, `em` and `calc()` are accepted, so an embed can size the
   * panel against the viewport instead of guessing pixels.
   * Default `calc(20vw + 60px)`.
   */
  width: string;
  /** Popup height, same units as `width`. Default `calc(40vh + 20px)`. */
  height: string;
  /** Width when expanded. Same units. Default 100% (true fullscreen). */
  expandedWidth: string;
  /** Height when expanded. Same units. Default 100%. */
  expandedHeight: string;
  /**
   * Gap left around the expanded panel, as a CSS length. Default 0, i.e. the
   * panel really does fill the screen. Set e.g. "16px" to float it instead.
   */
  expandedInset: string;
  /**
   * Hide the attach + microphone controls in the composer, leaving a
   * text-only input. Maps onto chat-component's `IConfig.disableMedia`.
   * Default TRUE for an assistant; pass "false" to re-enable them.
   */
  disableMedia: boolean;
  /**
   * Show the expand/collapse control in the popup header. When expanded the
   * panel fills the viewport (minus a small inset). Default true.
   */
  allowFullscreen: boolean;
  /**
   * Start the panel expanded. Only meaningful with `allowFullscreen`.
   * Default false.
   */
  startFullscreen: boolean;
  /**
   * URL of a custom launcher icon. Unlike `data-bot-avatar` (which is the
   * bot's identity and also shows in the header), this only replaces the
   * glyph on the floating launcher button.
   */
  launcherIcon?: string;
  /**
   * Two comma-separated colours painted as a 135deg gradient on the launcher,
   * e.g. "6e72fc,ad1deb". Defaults to the original widget's violet gradient.
   */
  launcherGradient?: [string, string];
  /**
   * Paint the launcher with the flat `primaryColor` instead of the default
   * violet gradient. Ignored when an explicit gradient is given. Default false.
   */
  flatLauncher: boolean;
  /** Launcher diameter in px. Default 56, as in the original widget. */
  launcherSize: number;
  /**
   * Pulsing glow around the launcher (the original's 2.5s pulseGlow).
   * Default true. Tinted with the gradient's end colour, or `primaryColor`
   * when `flatLauncher` is set.
   */
  launcherGlow: boolean;
  /**
   * Teaser shown ABOVE the closed launcher, then retired after 5s.
   * Empty string disables it. Default "Ask me anything!".
   */
  ctaText: string;
  /** Milliseconds before the teaser appears. Default 1200. */
  ctaDelay: number;
  /**
   * Show a small sparkle before the teaser text. Default true.
   */
  ctaSparkle: boolean;
}

const DEFAULT_PRIMARY = '#1976d2';
const DEFAULT_SECONDARY = '#E1E4FE';
// Desktop default: a viewport share plus a fixed nudge. The share keeps the
// panel sensible from a laptop to a 27" monitor; the +60/+20 is the margin
// that made the composer and the bubbles stop feeling cramped in review.
// toViewportLength maps the % to vw/vh, since the panel is position: fixed.
const DEFAULT_WIDTH = 'calc(20vw + 60px)';
const DEFAULT_HEIGHT = 'calc(40vh + 20px)';

export function readAppearance(
  get: (name: string) => string | undefined
): Appearance {
  const num = (v: string | undefined, fallback: number) => {
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  // CSS length. A bare number is px (the historical behaviour of data-width),
  // anything with a recognised unit passes through untouched. Unrecognised
  // input falls back rather than emitting an invalid declaration that would
  // silently collapse the panel to zero.
  const size = (v: string | undefined, fallback: string): string => {
    if (v === undefined) return fallback;
    const t = v.trim();
    if (!t) return fallback;
    if (/^-?\d+(\.\d+)?$/.test(t)) return `${t}px`;
    if (/^-?\d+(\.\d+)?(px|%|vw|vh|svh|dvh|rem|em)$/.test(t)) return t;
    // calc() lets a default mix a viewport share with a fixed nudge. Kept
    // deliberately narrow (digits, units, spaces and + - * /) so an embed
    // attribute can never inject arbitrary CSS into the style attribute.
    if (/^calc\([0-9a-z%.\s+\-*/()]+\)$/i.test(t)) return t;
    return fallback;
  };
  // Accept a bare hex ("7c3aed") and add the leading '#', so URL params don't
  // need it percent-encoded. Other CSS color forms pass through unchanged.
  const color = (v: string | undefined) => {
    if (!v) return undefined;
    const t = v.trim();
    return /^[0-9a-fA-F]{3,8}$/.test(t) ? `#${t}` : t;
  };
  // Boolean data-* attributes. Present-but-empty (`data-disable-media`) counts
  // as true, matching how HTML boolean attributes normally read.
  const flag = (v: string | undefined, fallback: boolean) => {
    if (v === undefined) return fallback;
    const t = v.trim().toLowerCase();
    if (t === '' || t === 'true' || t === '1' || t === 'yes') return true;
    if (t === 'false' || t === '0' || t === 'no') return false;
    return fallback;
  };
  // "7C4DFF,A020F0" or "#7C4DFF, #A020F0". Anything that isn't exactly two
  // colours is ignored so a typo degrades to the flat primary rather than to
  // an invalid `linear-gradient()` that paints nothing.
  const gradient = (v: string | undefined): [string, string] | undefined => {
    if (!v) return undefined;
    const parts = v
      .split(',')
      .map((p) => color(p.trim()))
      .filter((p): p is string => !!p);
    return parts.length === 2 ? [parts[0], parts[1]] : undefined;
  };
  const text = (v: string | undefined, fallback: string) =>
    v === undefined ? fallback : v;
  return {
    // Off by default: an AI assistant is a text conversation, and the attach
    // and mic controls invite uploads the bot cannot do anything with.
    // Set data-disable-media="false" to bring them back.
    disableMedia: flag(get('data-disable-media'), true),
    allowFullscreen: flag(get('data-allow-fullscreen'), true),
    startFullscreen: flag(get('data-start-fullscreen'), false),
    launcherIcon: get('data-launcher-icon'),
    launcherGradient: gradient(get('data-launcher-gradient')),
    flatLauncher: flag(get('data-flat-launcher'), false),
    launcherSize: num(get('data-launcher-size'), 56),
    launcherGlow: flag(get('data-launcher-glow'), true),
    ctaText: text(get('data-cta-text'), 'Ask me anything!'),
    ctaDelay: num(get('data-cta-delay'), 1200),
    ctaSparkle: flag(get('data-cta-sparkle'), true),
    primaryColor: color(get('data-primary-color')) || DEFAULT_PRIMARY,
    secondaryColor: color(get('data-secondary-color')) || DEFAULT_SECONDARY,
    iconsColor: color(get('data-icons-color')),
    ownBubbleBg: color(get('data-own-bubble-bg')),
    otherBubbleBg: color(get('data-other-bubble-bg')),
    inputBg: color(get('data-input-bg')),
    fontFamily: get('data-font-family'),
    fontSize: get('data-font-size'),
    googleFont: get('data-google-font'),
    locale: get('data-locale'),
    position: get('data-position') === 'left' ? 'left' : 'right',
    width: size(get('data-width'), DEFAULT_WIDTH),
    height: size(get('data-height'), DEFAULT_HEIGHT),
    expandedWidth: size(get('data-expanded-width'), '100%'),
    expandedHeight: size(get('data-expanded-height'), '100%'),
    expandedInset: size(get('data-expanded-inset'), '0px'),
  };
}
