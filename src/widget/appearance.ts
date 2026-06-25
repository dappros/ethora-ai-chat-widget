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
  /** Which side the launcher/popup dock to. Default "right". */
  position: 'left' | 'right';
  /** Popup width in px. Default 360. */
  width: number;
  /** Popup height in px. Default 560. */
  height: number;
}

const DEFAULT_PRIMARY = '#1976d2';
const DEFAULT_SECONDARY = '#E1E4FE';
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 560;

export function readAppearance(
  get: (name: string) => string | undefined
): Appearance {
  const num = (v: string | undefined, fallback: number) => {
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  // Accept a bare hex ("7c3aed") and add the leading '#', so URL params don't
  // need it percent-encoded. Other CSS color forms pass through unchanged.
  const color = (v: string | undefined) => {
    if (!v) return undefined;
    const t = v.trim();
    return /^[0-9a-fA-F]{3,8}$/.test(t) ? `#${t}` : t;
  };
  return {
    primaryColor: color(get('data-primary-color')) || DEFAULT_PRIMARY,
    secondaryColor: color(get('data-secondary-color')) || DEFAULT_SECONDARY,
    iconsColor: color(get('data-icons-color')),
    ownBubbleBg: color(get('data-own-bubble-bg')),
    otherBubbleBg: color(get('data-other-bubble-bg')),
    inputBg: color(get('data-input-bg')),
    fontFamily: get('data-font-family'),
    fontSize: get('data-font-size'),
    googleFont: get('data-google-font'),
    position: get('data-position') === 'left' ? 'left' : 'right',
    width: num(get('data-width'), DEFAULT_WIDTH),
    height: num(get('data-height'), DEFAULT_HEIGHT),
  };
}
