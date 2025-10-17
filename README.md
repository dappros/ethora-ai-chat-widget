# @ethora/ai-chat-widget

A production-ready React chat widget with assistant mode, powered by XMPP. Embed it on any site as a script or use it as a React component. Built and maintained by Ethora.

## Highlights

- Conversational assistant mode with anonymous user bootstrapping
- React component or zero-code script embed
- Battle-tested XMPP transport, Redux state, and styled-components UI
- Accessible UI, theming, and lightweight footprint

## Installation

```bash
npm install @ethora/ai-chat-widget
# or
yarn add @ethora/ai-chat-widget
```

## Quick start (React via npm)

```tsx
import React from 'react';
import {
  AiAssistant,
  XmppProvider,
  createAnonymousXmppCredentials,
} from '@ethora/ai-chat-widget';
import '@ethora/ai-chat-widget/dist/ai-chat-widget.css';

export default function App() {
  const user = createAnonymousXmppCredentials();
  const botId = import.meta.env.VITE_ASSISTANT_BOT_ID as string; // e.g. "xxxxx-bot@xmpp.example.com"

  return (
    <XmppProvider>
      <AiAssistant
        botId={botId}
        botAvatar={'https://example.com/path/to/avatar.png'}
        botDisplayName={'My Custom Bot'}
      />
    </XmppProvider>
  );
}
```

- `botId` is the assistant/bot JID, e.g. `xxxxx-bot@xmpp.example.com`.
- `botAvatar` sets the avatar URL displayed for the assistant.
- `botDisplayName` sets the human-friendly assistant name.
- `createAnonymousXmppCredentials()` is used internally by the assistant mode to bootstrap an ephemeral user.

Reference docs and examples: see the Ethora Chat Component on npm [(readme)](https://www.npmjs.com/package/@ethora/chat-component?activeTab=readme).

## Quick start (Script embed)

Use this when you want a drop-in widget without React. Ensure your server serves the built assets from `dist`.

```html
<link rel="stylesheet" href="/dist/ai-chat-widget.css" />
<script
  id="chat-content-assistant"
  data-bot-id="YOUR_BOT_JID"
  data-bot-avatar="https://example.com/path/to/avatar.png"
  data-bot-display-name="My Custom Bot"
  src="/dist/ethora_assistant.js"
  defer
></script>
```

Notes:

- The script auto-injects a `<div id="chat-widget">` and mounts the assistant into a Shadow DOM for safe styling isolation.
- You can dynamically change `data-bot-id`; relevant storage is cleared on change to avoid state leakage.
- Supported data attributes: `data-bot-id`, `data-bot-avatar`, `data-bot-display-name`.

## Configuration reference (essentials)

Below are commonly used options. The full config is typed by `IConfig` in `src/types/types.ts`.

```ts
interface IConfig {
  colors?: { primary?: string; secondary?: string };
  assistantButton?: {
    position?: { right?: number; bottom?: number };
    ariaLabel?: string;
  };
  assistantPopup?: {
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    closeButtonAriaLabel?: string;
  };
  assistantOpenStateKey?: string;
  disableMedia?: boolean;
  disableInteractions?: boolean;
  disableRooms?: boolean;
  xmppSettings?: {
    devServer?: string;
    host?: string;
    conference?: string;
  };
  assistantMode?: { enabled: boolean; user: { jid: string; password: string } };
  botAvatar?: string;
  botDisplayName?: string;
}
```

Recommended assistant defaults:

- `disableMedia`, `disableInteractions`, `disableRooms`: `true` for focused assistant UX.
- Provide `assistantOpenStateKey` to persist open/closed state across reloads.

## Public API

```ts
import {
  ChatComponent,
  XmppProvider,
  createAnonymousXmppCredentials,
} from '@ethora/ai-chat-widget';
```

- Library entry points: `main` → `dist/main.js`, types → `dist/main.d.ts`.

## Storage and state

The widget uses `localStorage` keys to persist user session and UI state. When `data-bot-id` changes (embed mode), it clears relevant keys to prevent cross-bot contamination.

Keys (subject to change):

- `EthoraAssistantOpen` / `assistantChatOpen` (open state)
- Assistant user, messages, and timestamps
- Redux persistence keys for settings and rooms

## Scripts

```bash
npm run dev       # Start example app (Vite)
npm run build     # Type-check then build widget and example
npm run build:lib # Build library bundles and types
npm run preview   # Preview example build
npm run lint      # Lint
npm run lint:fix  # Auto-fix lint and format
```

## Security considerations

- Use TLS (`wss://`) for XMPP WebSocket transport.
- In production, avoid long-lived anonymous credentials; provision user accounts or short-lived tokens.
- Validate and sanitize any user-provided content rendered in custom integrations.
- If embedding on third-party sites, ensure CSP and CORS policies are configured safely.

## Performance notes

- The widget mounts lazily and keeps a small DOM footprint.
- Prefer assistant mode with interactions disabled to minimize network chatter.
- Cache-bust and serve `dist` assets with HTTP compression (gzip/brotli) and long-lived cache headers.

## Accessibility

- Buttons and popups include ARIA labels; provide meaningful labels in config for your locale.
- Colors should meet contrast guidelines; customize `colors` accordingly.

## License

AGPL — see `LICENSE.txt`.

## Support

For enterprise support, feature requests, or integration help, contact Ethora.
