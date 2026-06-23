// Maps the server-issued widget-session envelope + embed overrides into the
// concrete values the chat-component <XmppProvider>/<Chat> need:
//   - `user`        : a pre-resolved visitor (xmpp creds) for userLogin
//   - `roomJID`     : the single MUC room to join + select
//   - `xmppSettings`: devServer (wss URL) / host / conference domain
//   - `persona`     : bot display name + avatar + greeting (cosmetic chrome)
//
// chat-component 26.5.x connects XMPP directly from `config.userLogin.user`
// when that user already carries xmppUsername + xmppPassword (no login form,
// no token exchange). `customRooms`/`singleRoom`/`forceSetRoom` are declared
// in IConfig but unused in 26.5.x; the working single-room combo is
// `roomJID` (active) + `defaultRooms` (force MUC join) + `disableRooms`.

import type { WidgetSessionEnvelope } from '../utils/provisionWidgetSession';

export interface EmbedOverrides {
  botName?: string;
  botAvatar?: string;
  title?: string;
  greetingTitle?: string;
  greeting?: string;
}

export interface ResolvedPersona {
  /** Name shown in the popup header + on bot bubbles. */
  botName: string;
  /** Avatar URL shown in the launcher / header. Empty string = use initial. */
  botAvatar: string;
  /** Header label (defaults to bot name). */
  title: string;
  /** Empty-state heading. */
  greetingTitle: string;
  /** Empty-state body copy. */
  greeting: string;
}

export interface ResolvedXmppSettings {
  /** Websocket URL the client binds to, e.g. wss://host/ws. */
  devServer: string;
  /** XMPP host, e.g. xmpp.host. */
  host: string;
  /** MUC/conference domain, e.g. conference.host. */
  conference: string;
}

export interface ResolvedVisitorUser {
  _id: string;
  name: string;
  walletAddress: string;
  firstName: string;
  lastName: string;
  xmppUsername: string;
  xmppPassword: string;
  token: string;
  refreshToken: string;
  defaultWallet: { walletAddress: string };
}

export interface ResolvedSession {
  user: ResolvedVisitorUser;
  roomJID: string;
  xmppSettings: ResolvedXmppSettings;
  persona: ResolvedPersona;
}

// Derive the XMPP host from a JID's domain part. Used to bootstrap the XMPP
// client config from server-issued visitor / room JIDs when the response
// omits an explicit `xmpp` block (older API versions / test envelopes).
const hostFromJid = (jid?: string): string => {
  if (!jid || !jid.includes('@')) return '';
  return jid.split('@')[1] || '';
};

export function resolveSession(
  envelope: WidgetSessionEnvelope,
  overrides: EmbedOverrides = {}
): ResolvedSession {
  // Prefer the fully-qualified host from the server response; fall back to
  // deriving it from any JID in the envelope.
  const host =
    envelope.xmpp?.host ||
    hostFromJid(envelope.bot.jid) ||
    hostFromJid(envelope.visitor.jid) ||
    hostFromJid(envelope.bot.xmppUsername);

  const conference =
    envelope.xmpp?.service || (host ? `conference.${host}` : '');

  // Default to production-canonical `wss://<host>/ws` (nginx-proxied, 443).
  // The server surfaces the canonical URL via envelope.xmpp.wsUrl when present.
  const devServer =
    envelope.xmpp?.wsUrl || (host ? `wss://${host}/ws` : '');

  const roomJID =
    envelope.room.jid ||
    (conference ? `${envelope.room.name}@${conference}` : envelope.room.name);

  // The visitor identity used for the SASL bind. xmppUsername + xmppPassword
  // are appId-prefixed (`${appId}_widget-<uuid>`) so mod_ethora's per-app
  // guard accepts presence into the MUC room.
  const user: ResolvedVisitorUser = {
    _id: envelope.visitor.uuid || envelope.visitor.xmppUsername,
    name: envelope.visitor.xmppUsername,
    walletAddress: '',
    firstName: 'Visitor',
    lastName: '',
    xmppUsername: envelope.visitor.xmppUsername,
    xmppPassword: envelope.visitor.xmppPassword,
    token: '',
    refreshToken: '',
    defaultWallet: { walletAddress: '' },
  };

  // Resolution chain: explicit embed override -> active Agent persona
  // (envelope.bot.*) -> platform fallback copy.
  const botName = overrides.botName || envelope.bot.displayName || 'AI Assistant';
  const botAvatar = overrides.botAvatar || envelope.bot.avatarUrl || '';
  const title = overrides.title || botName;
  const greetingTitle = overrides.greetingTitle || 'Write a question';
  const greeting =
    overrides.greeting ||
    envelope.bot.greetingMessage ||
    `Our ${botName} will be happy to help`;

  return {
    user,
    roomJID,
    xmppSettings: { devServer, host, conference },
    persona: { botName, botAvatar, title, greetingTitle, greeting },
  };
}
