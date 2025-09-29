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

## Quick start (React)

```tsx
import React from 'react';
import {
  ChatComponent,
  XmppProvider,
  createAnonymousXmppCredentials,
} from '@ethora/ai-chat-widget';
import '@ethora/ai-chat-widget/dist/ai-chat-widget.css';

export default function App() {
  const user = createAnonymousXmppCredentials();

  return (
    <XmppProvider>
      <ChatComponent
        roomJID={process.env.REACT_APP_ASSISTANT_BOT_ID}
        config={{
          assistantMode: { enabled: true, user },
          assistantOpenStateKey: 'EthoraAssistantOpen',
          colors: { primary: '#1976d2', secondary: '#E1E4FE' },
          xmppSettings: {
            devServer: 'wss://xmpp.ethoradev.com:5443/ws',
            host: 'xmpp.ethoradev.com',
            conference: 'conference.xmpp.ethoradev.com',
          },
          assistantButton: {
            position: { right: 24, bottom: 24 },
            ariaLabel: 'Open assistant chat',
          },
          assistantPopup: {
            width: 320,
            height: 520,
            closeButtonAriaLabel: 'Close assistant chat',
          },
        }}
      />
    </XmppProvider>
  );
}
```

- `roomJID` is the assistant/bot JID, e.g. `xxxxx-bot@xmpp.example.com`.
- `createAnonymousXmppCredentials()` generates ephemeral user credentials for quick bootstrap.

## Quick start (Script embed)

Use this when you want a drop-in widget without React. Ensure your bundler or server serves the built assets (`dist`).

```html
<link rel="stylesheet" href="/dist/ai-chat-widget.css" />
<script
  id="chat-content-assistant"
  data-bot-id="YOUR_BOT_JID"
  src="/dist/main.js"
  defer
></script>
```

Notes:

- The script auto-injects a `<div id="chat-widget">` and mounts the assistant.
- You can dynamically change the `data-bot-id`; storage is cleared on change to avoid state leakage.

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
  xmppSettings: {
    devServer: string; // wss URL
    host: string; // XMPP domain
    conference: string; // MUC domain
  };
  assistantMode?: { enabled: boolean; user: { jid: string; password: string } };
}
```

Recommended assistant defaults:

- `disableMedia`, `disableInteractions`, `disableRooms`: `true` for focused assistant UX.
- Provide `assistantOpenStateKey` to persist open/closed state across reloads.

## Public API

```ts
import {
  ChatComponent, // React component (Redux-backed)
  XmppProvider, // Context provider for XMPP
  createAnonymousXmppCredentials, // Helper to generate ephemeral credentials
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

## Troubleshooting

- Nothing renders: ensure `dist/main.js` and `dist/ai-chat-widget.css` are served and reachable.
- Connection issues: double-check `xmppSettings` (`devServer`, `host`, `conference`).
- State glitches after switching bots: confirm the `data-bot-id` changes; the widget clears storage automatically.

## License

AGPL — see `LICENSE.txt`.

## Support

For enterprise support, feature requests, or integration help, contact Ethora.
