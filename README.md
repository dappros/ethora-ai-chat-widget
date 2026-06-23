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

There are two paths, depending on whether you want a persistent server-side conversation or a stateless 1:1 chat. **New integrations should use the MUC variant** — it's what the production `assistant.js` bundle and the WordPress plugin both run.

### MUC variant (recommended) — server-provisioned visitor + persistent room

The widget calls `POST /v2/widget/sessions` on the platform, which mints an app-prefixed visitor (`<appId>_widget-<uuid>`) and a persistent MUC room. The visitor and the bot are pre-affiliated as members; messages flow as `groupchat` and are archived in `mod_mam`, so operators can review historical conversations later under the **AI Widget → Conversations** panel.

```tsx
import {
  Chat,
  XmppProvider,
  provisionWidgetSession,
} from '@ethora/ai-chat-widget';

export function Assistant() {
  const [envelope, setEnvelope] = React.useState(null);

  React.useEffect(() => {
    provisionWidgetSession({
      appId: 'YOUR_APP_ID',                       // from app.chat.ethora.com
      apiBase: 'https://api.chat.ethora.com',     // your install's API root
    }).then(setEnvelope);
  }, []);

  if (!envelope) return null;

  const user = {
    id: envelope.visitor.xmppUsername,
    name: envelope.visitor.xmppUsername,
    xmppUsername: envelope.visitor.xmppUsername,
    xmppPassword: envelope.visitor.xmppPassword,
  };

  return (
    <XmppProvider>
      <Chat
        roomJID={envelope.room.jid}
        config={{
          assistantMode: { enabled: true, user },
          xmppSettings: {
            host: envelope.xmpp.host,
            conference: envelope.xmpp.service,
            devServer: envelope.xmpp.wsUrl,        // e.g. wss://xmpp.../ws
          },
        }}
      />
    </XmppProvider>
  );
}
```

The visitor identity is keyed in `localStorage` under `__widgetSessionStorage` so a returning browser resumes its visitor. Pass `resumeXmppUsername` to `provisionWidgetSession` if you store it yourself.

The standalone embed (`assistant.js`, served from your install's `widget.<domain>` host) wraps the same flow behind a `<script>` tag — see [`src/main.tsx`](./src/main.tsx) and [`src/AssistantTest.tsx`](./src/AssistantTest.tsx) for the canonical wiring.

### Legacy 1:1 anonymous variant

For demos or stateless integrations where you don't need persistent rooms or operator review, the original anonymous credential helper still works:

```tsx
import {
  Chat,
  XmppProvider,
  createAnonymousXmppCredentials,
} from '@ethora/ai-chat-widget';

const botId = 'YOUR_BOT_JID'; // e.g. `${appId}_${userId}-bot@xmpp.chat.ethora.com`

export function Assistant() {
  const user = createAnonymousXmppCredentials();

  return (
    <XmppProvider>
      <Chat
        roomJID={botId}
        config={{
          assistantMode: { enabled: true, user },
        }}
      />
    </XmppProvider>
  );
}
```

`createAnonymousXmppCredentials()` mints a per-visitor anonymous XMPP identity so the widget can connect without you having to manage user accounts. Conversations are 1:1, not archived under any operator-visible room, and the visitor JID has no app prefix — so the platform's per-app guards (`mod_ethora`) will reject MUC presence into app-scoped rooms. Use this only when you specifically don't want server-side persistence.

## Related

- [`@ethora/chat-component`](https://github.com/dappros/ethora-chat-component) — full React chat UI (rooms, auth, profiles, push)
- [`ethora-wp-plugin`](https://github.com/dappros/ethora-wp-plugin) — drops the same widget into WordPress with no code
- [Ethora monorepo](https://github.com/dappros/ethora) — full ecosystem entry point

## License

AGPL — see [LICENSE](./LICENSE).
