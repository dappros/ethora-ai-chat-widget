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

/** Shown when neither the embed nor the Agent supplies an opening line. */
const DEFAULT_GREETING_MESSAGE = 'Hi, how can I help you?';

export interface EmbedOverrides {
  botName?: string;
  botAvatar?: string;
  title?: string;
  greetingTitle?: string;
  greeting?: string;
  /**
   * Opening line shown as a bot bubble when the conversation is empty.
   * Distinct from `greeting`, which is the empty-state subtitle: setting this
   * replaces the empty state entirely, because the room is no longer empty.
   */
  greetingMessage?: string;
  /**
   * Hide MUC system messages (e.g. "X has joined the chat") in the assistant.
   * Defaults to true - they are noise in a single-bot conversation. Set the
   * embed's `data-hide-system-messages="false"` to show them.
   */
  hideSystemMessages?: boolean;
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
  /** Opening bot bubble. Empty string means no starter message. */
  greetingMessage: string;
  /** Bot's xmpp username, needed to attribute the starter bubble to the bot. */
  botXmppUsername: string;
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
  // Deliberately no longer falls back to `envelope.bot.greetingMessage`: that
  // field is the Agent's opening LINE and now drives the starter bubble, so
  // using it here too printed the same sentence in two places.
  const greeting =
    overrides.greeting || `Our ${botName} will be happy to help`;

  // Resolution: explicit embed attribute -> the Agent's own greeting from the
  // server -> a neutral default. The default exists because an assistant that
  // opens with a blank panel reads as broken; an operator who genuinely wants
  // silence sets data-greeting-message="".
  const greetingMessage =
    overrides.greetingMessage ??
    (envelope.bot.greetingMessage || DEFAULT_GREETING_MESSAGE);

  return {
    user,
    roomJID,
    xmppSettings: { devServer, host, conference },
    persona: {
      botName,
      botAvatar,
      title,
      greetingTitle,
      greeting,
      greetingMessage,
      botXmppUsername: envelope.bot.xmppUsername,
    },
  };
}
