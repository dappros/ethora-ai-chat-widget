# `@ethora/ai-chat-widget`

Embeddable **AI assistant chat widget** for any website. Drop in a single `<script>` tag and a floating chat launcher appears, wired to your Ethora-hosted (or self-hosted) AI bot. Visitors chat anonymously - no sign-up, no login - and the conversation lives in a persistent, operator-reviewable room.

**Part of the [Ethora SDK ecosystem](https://github.com/dappros/ethora#ecosystem)** - see all SDKs, tools, and sample apps.

> Looking for the full chat UI (rooms, multiple users, auth)? Use [`@ethora/chat-component`](https://github.com/dappros/ethora-chat-component) instead. This package is a focused **assistant** widget - one bot, one anonymous visitor, no login. Internally it is a thin shell over `@ethora/chat-component`, so it inherits the same chat engine.

## Quick start (embed)

Add one script tag to your page. Get the `data-app-id` from [app.chat.ethora.com](https://app.chat.ethora.com).

```html
<script
  src="https://your-host/ethora_assistant.js"
  id="chat-content-assistant"
  data-app-id="YOUR_APP_ID"
></script>
```

That's it - the widget provisions a visitor + room and connects on first open.

### Embed attributes

| Attribute | Required | Purpose |
|-----------|----------|---------|
| `data-app-id` | yes* | Your Ethora app id. |
| `data-bot-id` | * | A bot JID; the app id is derived from its prefix when `data-app-id` is absent (back-compat). |
| `data-api-url` | no | API base. Default `https://api.chat.ethora.com/v1`. Point at a self-hosted install here. |
| `data-bot-name` | no | Override the bot display name shown in the header. |
| `data-bot-avatar` | no | Override the bot avatar URL. |
| `data-title` | no | Override the popup header title (defaults to the bot name). |
| `data-greeting-title` / `data-greeting` | no | Override the empty-state copy. |
| `data-hide-system-messages` | no | `"false"` to show MUC join/leave messages. Default: hidden. |

\* Provide either `data-app-id` or `data-bot-id`.

### Appearance attributes

All optional - the widget theming maps onto the chat engine's config.

| Attribute | Purpose |
|-----------|---------|
| `data-primary-color` | Header + launcher color, chat accent. Default `#1976d2`. |
| `data-secondary-color` | Chat secondary color. Default `#E1E4FE`. |
| `data-icons-color` | Color of the attach / send / mic icons. |
| `data-own-bubble-bg` | Background of the visitor's own message bubbles. |
| `data-other-bubble-bg` | Background of the bot's message bubbles. |
| `data-input-bg` | Background of the message input bar. |
| `data-font-family` | Font family applied to the chat. |
| `data-font-size` | Base font size, e.g. `16` or `1.1rem`. |
| `data-google-font` | Google Fonts family to auto-load + apply (e.g. `Inter`). |
| `data-position` | `left` or `right` - which side to dock. Default `right`. |
| `data-width` / `data-height` | Popup size in px. Default `360` / `560`. |

```html
<script
  src="https://your-host/ethora_assistant.js"
  id="chat-content-assistant"
  data-app-id="YOUR_APP_ID"
  data-primary-color="#7c3aed"
  data-position="left"
  data-google-font="Inter"
></script>
```

### URL overrides

The appearance + cosmetic keys can also be set (and override the `data-*`) via
page URL query params, prefixed with `ethora-`. Handy for previews and
per-link theming. A `#` in a color may be omitted.

```
https://yoursite.com/page?ethora-primary-color=059669&ethora-position=right&ethora-google-font=Inter
```

For safety, `app-id` / `api-url` / `bot-id` are **not** URL-overridable - a URL
can never repoint the widget at a different bot or backend.

### Connection states

The assistant always has a known room, so it never shows a "create a room"
screen. While it settles you see a **Connecting…** spinner, and if the browser
is offline a **No internet connection** placard - the chat reconnects on its own.

## How it works

On first open the widget calls `POST /v2/widget/sessions`, which mints an app-prefixed visitor (`<appId>_widget-<uuid>`) and a persistent MUC room. The visitor and the bot are pre-affiliated as members; messages flow as `groupchat` and are archived in `mod_mam`, so operators can review conversations later. The visitor identity is kept in `localStorage` so a returning browser resumes the same session.

The chat renders inside a **Shadow DOM**, so the widget's styles never leak onto - or get overridden by - the host page.

## Default backend endpoints

| Purpose | Default value |
|---------|---------------|
| API base URL | `https://api.chat.ethora.com/v1` |
| XMPP WebSocket | `wss://xmpp.chat.ethora.com/ws` |
| Sign up / get an `appId` | [app.chat.ethora.com](https://app.chat.ethora.com) |
| API docs (Swagger) | [api.chat.ethora.com/api-docs/#/](https://api.chat.ethora.com/api-docs/#/) |

## Build

The widget is built as a single self-contained IIFE bundle. It consumes `@ethora/chat-component` **from source** (the sibling repo `../ethora-chat-component`), so that repo must be present next to this one.

```bash
npm install
npx vite build --minify false   # -> dist/ethora_assistant.js
```

Use `npx vite build` (not `npm run build`, whose `tsc` gate can leave a stale bundle). The output stays un-minified / human-readable (required for the WordPress.org plugin). Heavy features the assistant doesn't use (push/Firebase, the emoji-reaction picker, WebRTC video calls, raw-HTML markdown) are stubbed out at build time to keep the bundle small; voice messages and markdown formatting are kept.

For a quick local test, open [`index.html`](./index.html) (it loads the built `dist/`) and set a real `data-app-id`.

## Related

- [`@ethora/chat-component`](https://github.com/dappros/ethora-chat-component) - full React chat UI (rooms, auth, profiles, push)
- [`ethora-wp-plugin`](https://github.com/dappros/ethora-wp-plugin) - drops this widget into WordPress with no code
- [Ethora monorepo](https://github.com/dappros/ethora) - full ecosystem entry point

## License

AGPL - see [LICENSE](./LICENSE).
