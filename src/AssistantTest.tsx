import { ReduxWrapper } from './components/MainComponents/ReduxWrapper';
import { XmppProvider } from './main';
import { IConfig } from './types/types';
import { WidgetSessionEnvelope } from './utils/provisionWidgetSession';

// Derive the XMPP host from a JID's domain part. Used to bootstrap the
// XMPP client config from server-issued visitor / room JIDs.
const getXmppDomainFromJid = (jid?: string): string => {
  if (!jid || !jid.includes('@')) {
    return '';
  }
  return jid.split('@')[1] || '';
};

// Derive the XMPP MUC service ("conference.<host>") for a given visitor JID
// host. The server-side widget session response gives us a room *name* like
// `${appId}_<roomUuid>`; we attach this conference suffix client-side so the
// embed only needs the appId / API base from the script tag.
const conferenceServiceFor = (host: string): string => {
  if (!host) return '';
  return `conference.${host}`;
};

// Per-embed overrides sourced from <script> tag attributes (main.tsx
// reads them; AssistantTest applies them as defaults below). Every
// field is optional — when missing we fall through the resolution
// chain: override -> envelope.bot persona (active Agent) -> platform
// default.
export interface AssistantTestOverrides {
  botName?: string;
  botAvatar?: string;
  title?: string;
  greetingTitle?: string;
  greeting?: string;
}

interface AssistantTestProps {
  envelope: WidgetSessionEnvelope;
  // apiBase is consumed by main.tsx for the session-provisioning POST and
  // is currently not needed inside the React tree itself. Kept on the prop
  // surface so future features (history fetch, RAG re-ranking calls, etc.)
  // can opt in without re-plumbing.
  apiBase?: string;
  overrides?: AssistantTestOverrides;
}

const buildAssistantChatConfig = (
  xmppHost: string,
  conferenceService: string,
  wsUrl?: string
): IConfig => {
  // Default to the production-canonical `wss://<host>/ws` (nginx-proxied,
  // standard 443). The legacy `:5443/ws` pattern only works on dev-style
  // installs where ejabberd's host is reachable on a non-standard port —
  // production deploys terminate WSS at nginx and reverse-proxy to ejabberd
  // internally, so requests to `:5443` from a third-party browser fail
  // with `WebSocket ECONNERROR`. The server-side widget session response
  // surfaces the canonical URL via `envelope.xmpp.wsUrl` when present;
  // fall back to deriving it from the host otherwise.
  const devServer = wsUrl || (xmppHost ? `wss://${xmppHost}/ws` : '');
  return {
    colors: { primary: '#1976d2', secondary: '#E1E4FE' },
    assistantButton: {
      position: { right: 24, bottom: 24 },
      ariaLabel: 'Open assistant chat',
    },
    assistantPopup: {
      width: 320,
      height: 520,
      style: { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
      closeButtonAriaLabel: 'Close assistant chat',
    },
    assistantOpenStateKey: 'EthoraAssistantOpen',
    disableMedia: true,
    disableInteractions: true,
    disableRooms: true,
    xmppSettings: {
      devServer,
      host: xmppHost,
      conference: conferenceService,
    },
  };
};

export default function AssistantTest({ envelope, overrides }: AssistantTestProps) {
  // The visitor user object is what useChatWrapperInitAssistant consumes
  // for SASL bind. xmppUsername + xmppPassword come from the server-issued
  // session envelope — these are appId-prefixed (`${appId}_widget-<uuid>`)
  // so mod_ethora's per-app guard accepts presence into the room below.
  const user = {
    id: envelope.visitor.xmppUsername,
    name: envelope.visitor.xmppUsername,
    xmppUsername: envelope.visitor.xmppUsername,
    xmppPassword: envelope.visitor.xmppPassword,
  };

  // Prefer fully-qualified host from the server response; fall back to
  // deriving it from any JID in the envelope so the widget keeps working
  // against older API versions (or unit-test envelopes) that don't surface
  // the xmpp block. The server attaches conference.<host> for us, which
  // means we don't have to hardcode the conference subdomain shape here.
  const xmppHost =
    envelope.xmpp?.host ||
    getXmppDomainFromJid(envelope.bot.jid) ||
    getXmppDomainFromJid(envelope.visitor.jid) ||
    getXmppDomainFromJid(envelope.bot.xmppUsername);
  const conferenceService =
    envelope.xmpp?.service || conferenceServiceFor(xmppHost);
  const roomJID =
    envelope.room.jid || `${envelope.room.name}@${conferenceService}`;

  const assistantChatConfig = buildAssistantChatConfig(
    xmppHost,
    conferenceService,
    envelope.xmpp?.wsUrl
  );

  // Resolution chain for persona-bearing config fields:
  // explicit override -> active Agent (envelope.bot.*) -> platform fallback.
  // Operators get sane defaults for free; teams that need per-embed
  // overrides set them on the <script> tag.
  const botName =
    overrides?.botName || envelope.bot?.displayName || '';
  const botAvatar =
    overrides?.botAvatar || envelope.bot?.avatarUrl || '';
  const chatLabel = overrides?.title || botName || 'AI Assistant';
  const greetingTitle =
    overrides?.greetingTitle || 'Write a question';
  const greetingMessage =
    overrides?.greeting ||
    envelope.bot?.greetingMessage ||
    `Our ${botName || 'AI Assistant'} will be happy to help`;

  return (
    <XmppProvider>
      <ReduxWrapper
        roomJID={roomJID}
        config={{
          ...assistantChatConfig,
          assistantMode: { enabled: true, user },
          chatLabel,
          botDisplayName: botName,
          botAvatar,
          greetingTitle,
          greetingMessage,
        }}
      />
    </XmppProvider>
  );
}
