# `@ethora/ai-chat-widget`

Drop-in React widget for embedding an Ethora AI assistant chat into any web app. Pairs an Ethora-hosted (or self-hosted) AI bot with anonymous XMPP credentials so visitors can chat without signing up.

**Part of the [Ethora SDK ecosystem](https://github.com/dappros/ethora#ecosystem)** — see all SDKs, tools, and sample apps. Follow cross-SDK updates in the [Release Notes](https://github.com/dappros/ethora/blob/main/RELEASE-NOTES.md).

> Looking for the full chat UI (rooms, multiple users, auth)? Use [`@ethora/chat-component`](https://github.com/dappros/ethora-chat-component) instead. This package is a focused **assistant** widget — one bot, one anonymous visitor, no login.

## Install

```bash
npm install @ethora/ai-chat-widget
# or
yarn add @ethora/ai-chat-widget
```

## Default backend endpoints

| Purpose | Default value |
|---------|---------------|
| API base URL | `https://api.chat.ethora.com/v1` |
| XMPP WebSocket | `wss://xmpp.chat.ethora.com:5443/ws` |
| Sign up / get a `botId` | [app.chat.ethora.com](https://app.chat.ethora.com) |
| API docs (Swagger) | [api.chat.ethora.com/api-docs/#/](https://api.chat.ethora.com/api-docs/#/) |

To target QA, override with `chat-qa.ethora.com` equivalents.

## Usage

```tsx
import {
  ChatAssistant,
  assistantChatConfig,
  createAnonymousXmppCredentials,
} from '@ethora/ai-chat-widget';

const botId = 'YOUR_BOT_JID'; // e.g. `${appId}_${userId}-bot@xmpp.chat.ethora.com`

export function Assistant() {
  const user = createAnonymousXmppCredentials();

  return (
    <ChatAssistant
      roomJID={botId}
      config={{
        ...assistantChatConfig,
        assistantMode: { enabled: true, user },
      }}
    />
  );
}
```

`createAnonymousXmppCredentials()` mints a per-visitor anonymous XMPP identity so the widget can connect without you having to manage user accounts. The `botId` is the JID of the AI bot configured for your app — you can copy it from the AI Widget tab inside [app.chat.ethora.com](https://app.chat.ethora.com) after enabling a bot for your app.

## Related

- [`@ethora/chat-component`](https://github.com/dappros/ethora-chat-component) — full React chat UI (rooms, auth, profiles, push)
- [`ethora-wp-plugin`](https://github.com/dappros/ethora-wp-plugin) — drops the same widget into WordPress with no code
- [Ethora monorepo](https://github.com/dappros/ethora) — full ecosystem entry point

## License

AGPL — see [LICENSE](./LICENSE).
