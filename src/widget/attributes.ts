// The embed contract, in one place.
//
// Every `data-*` the widget reads is declared here once. Two consumers use it:
//
//   - the admin app (ethora-app-reactjs) renders its "embed code" tab from
//     `window.EthoraAssistant.attributes`, so the snippet it hands operators
//     cannot drift from what the bundle actually reads. It had drifted: the
//     admin offered four optional attributes while the widget read over
//     thirty;
//   - `attributes.contract.test.ts` scans appearance.ts and main.tsx and
//     fails if either declares an attribute this list is missing, or lists
//     one nothing reads. Adding an attribute without documenting it is
//     therefore a build failure rather than a support ticket.

export type AttributeGroup = 'core' | 'copy' | 'theme' | 'layout' | 'launcher';

export interface AttributeSpec {
  /** Full attribute name, e.g. "data-app-id". */
  name: string;
  group: AttributeGroup;
  /** True only for attributes without which the widget cannot start. */
  required?: boolean;
  /** Superseded name kept working for older embeds. */
  deprecatedAliasFor?: string;
  /** Shown in the generated snippet. Empty for values that must be supplied. */
  example: string;
  doc: string;
}

export const WIDGET_ATTRIBUTES: readonly AttributeSpec[] = [
  // --- core -------------------------------------------------------------
  {
    name: 'data-app-id',
    group: 'core',
    required: true,
    example: '',
    doc: 'The Ethora app id. Required unless data-bot-id is given.',
  },
  {
    name: 'data-bot-id',
    group: 'core',
    example: '',
    doc: 'Back-compat: a bot JID. The app id is derived from its prefix when data-app-id is absent.',
  },
  {
    name: 'data-api-base',
    group: 'core',
    example: 'https://api.chat.ethora.com/v1',
    doc: 'API base URL. Defaults to the api.* host derived from the script src.',
  },
  {
    name: 'data-api-url',
    group: 'core',
    deprecatedAliasFor: 'data-api-base',
    example: '',
    doc: 'Alias for data-api-base.',
  },

  // --- copy -------------------------------------------------------------
  {
    name: 'data-bot-name',
    group: 'copy',
    example: 'Ethora Assistant',
    doc: "Bot display name, used everywhere the bot appears: header, greeting and every bot message. Defaults to the active Agent's name, then to the name the bot gives on its own messages.",
  },
  {
    name: 'data-bot-display-name',
    group: 'copy',
    deprecatedAliasFor: 'data-bot-name',
    example: '',
    doc: 'Alias for data-bot-name.',
  },
  {
    name: 'data-bot-avatar',
    group: 'copy',
    example: 'https://your-cdn/avatar.png',
    doc: "Bot avatar URL, shown on the bot's messages only. Never used for the launcher or the header - set data-launcher-icon for those.",
  },
  {
    name: 'data-title',
    group: 'copy',
    example: 'Chat with us',
    doc: 'Header label. Defaults to the bot name.',
  },
  {
    name: 'data-greeting-title',
    group: 'copy',
    example: 'Ask me anything',
    doc: 'Empty-state heading.',
  },
  {
    name: 'data-greeting',
    group: 'copy',
    example: 'I can help with pricing, setup and support.',
    doc: 'Empty-state body line.',
  },
  {
    name: 'data-greeting-message',
    group: 'copy',
    example: 'Hi! How can I help?',
    doc: "Opening bot bubble. Rendered locally and never sent over XMPP. Defaults to the Agent's greeting, then to \"Hi, how can I help you?\". Empty string disables it.",
  },
  {
    name: 'data-locale',
    group: 'copy',
    example: 'en',
    doc: "UI caption language. Defaults to the page's <html lang>, then the browser.",
  },
  {
    name: 'data-language-selector',
    group: 'copy',
    example: 'false',
    doc: 'Globe in the header that lets the reader pick the UI language (English, Español, Français). Default true; the choice is remembered. Set false to hide it.',
  },
  {
    name: 'data-color-scheme',
    group: 'theme',
    example: 'system',
    doc: 'Chat colour scheme: light (default), dark, or system to follow the visitor\'s OS setting.',
  },
  {
    name: 'data-hide-system-messages',
    group: 'copy',
    example: 'true',
    doc: 'Hide "X has joined" notices. Default true; set false to show them.',
  },

  // --- theme ------------------------------------------------------------
  {
    name: 'data-primary-color',
    group: 'theme',
    example: '0052CD',
    doc: 'Header and accent colour. Bare hex accepted.',
  },
  { name: 'data-secondary-color', group: 'theme', example: 'E1E4FE', doc: 'Secondary chat colour.' },
  { name: 'data-icons-color', group: 'theme', example: '', doc: 'Composer icon colour. Falls back to primary.' },
  { name: 'data-own-bubble-bg', group: 'theme', example: '', doc: "Visitor's own message bubble background." },
  { name: 'data-other-bubble-bg', group: 'theme', example: '', doc: "Bot's message bubble background." },
  { name: 'data-input-bg', group: 'theme', example: '', doc: 'Composer background.' },
  { name: 'data-font-family', group: 'theme', example: '', doc: 'Explicit font family for the chat and chrome.' },
  { name: 'data-font-size', group: 'theme', example: '', doc: 'Base font size, e.g. "16".' },
  { name: 'data-google-font', group: 'theme', example: 'Inter', doc: 'Google Fonts family to load automatically.' },
  {
    name: 'data-button-style',
    group: 'theme',
    example: 'pill',
    doc: 'Look of the quick-reply buttons: "pill" (default, outlined buttons that fill on hover) or "list" (one bordered row per option with a chevron).',
  },

  // --- layout -----------------------------------------------------------
  { name: 'data-position', group: 'layout', example: 'right', doc: 'Dock side: "left" or "right". Default right.' },
  {
    name: 'data-width',
    group: 'layout',
    example: '384px',
    doc: 'Docked panel width. Bare number = px; px, %, vw, vh, rem, em, calc(), clamp(), min() and max() accepted. Default 384px. Readers can drag the top-left corner to resize. Under 520px wide the panel becomes a full-width bottom sheet.',
  },
  {
    name: 'data-height',
    group: 'layout',
    example: '524px',
    doc: 'Docked panel height, same units. Default 524px.',
  },
  { name: 'data-expanded-width', group: 'layout', example: '100%', doc: 'Width when expanded. Default 100%.' },
  { name: 'data-expanded-height', group: 'layout', example: '100%', doc: 'Height when expanded. Default 100%.' },
  {
    name: 'data-expanded-inset',
    group: 'layout',
    example: '0px',
    doc: 'Gap around the expanded panel. Default 0px, i.e. edge to edge with no radius or shadow.',
  },
  {
    name: 'data-disable-media',
    group: 'layout',
    example: 'true',
    doc: 'Hide the attach and microphone controls. Default true; pass "false" to re-enable them.',
  },
  {
    name: 'data-allow-fullscreen',
    group: 'layout',
    example: 'true',
    doc: 'Show the expand control in the header. Default true.',
  },
  { name: 'data-start-fullscreen', group: 'layout', example: 'false', doc: 'Open expanded. Default false.' },

  // --- launcher ---------------------------------------------------------
  { name: 'data-launcher-icon', group: 'launcher', example: 'https://your-site/icon.png', doc: 'Widget icon URL (any image URL, e.g. a file from a media library). Shown on the launcher and in the panel header, contained not cropped. Without it the launcher shows the default glyph and the header the first letter of the title.' },
  {
    name: 'data-launcher-gradient',
    group: 'launcher',
    example: '6e72fc,ad1deb',
    doc: 'Two comma-separated colours for the launcher gradient.',
  },
  { name: 'data-flat-launcher', group: 'launcher', example: 'false', doc: 'Use the flat primary colour instead of the gradient.' },
  { name: 'data-launcher-size', group: 'launcher', example: '56', doc: 'Launcher diameter in px. Default 56.' },
  { name: 'data-launcher-glow', group: 'launcher', example: 'true', doc: 'Pulsing glow around the launcher. Default true.' },
  {
    name: 'data-cta-text',
    group: 'launcher',
    example: 'Ask me anything!',
    doc: 'Teaser above the closed launcher. Empty string disables it.',
  },
  { name: 'data-cta-delay', group: 'launcher', example: '1200', doc: 'Milliseconds before the teaser appears.' },
  { name: 'data-cta-sparkle', group: 'launcher', example: 'true', doc: 'Show the leading sparkle in the teaser.' },
] as const;

/** Attributes without which the widget refuses to start. */
export const REQUIRED_ATTRIBUTES = WIDGET_ATTRIBUTES.filter((a) => a.required);

/** Everything else, in the order the admin should present it. */
export const OPTIONAL_ATTRIBUTES = WIDGET_ATTRIBUTES.filter(
  (a) => !a.required && !a.deprecatedAliasFor
);
