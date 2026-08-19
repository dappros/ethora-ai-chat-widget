// Starter (greeting) message.
//
// Renders as a normal bot bubble but is NEVER sent over XMPP: it is injected
// straight into chat-component's redux store. So the visitor sees the
// assistant open the conversation, while the room on the server stays empty
// until they actually say something, and the bot's own LLM context is not
// polluted with a line it never produced.
//
// `MessageContainer` decides sides with `message.user.id === xmppUsername`, so
// setting `user.id` to the BOT's xmpp username is what puts the bubble on the
// left with the bot's name and avatar.
import { store } from '@ethora/chat-component/roomStore';
import { addRoomMessage } from '@ethora/chat-component/roomStore/roomsSlice';

export interface GreetingInput {
  roomJID: string;
  /** Copy to show. Nothing is injected when this is empty. */
  text: string;
  /** Bot's xmpp username, e.g. `<appId>_<id>-bot`. Drives the left/right side. */
  botXmppUsername: string;
  botName: string;
  botAvatar?: string;
}

/**
 * Deterministic id. Two things depend on it:
 *  - the slice dedupes by id, so a re-run (StrictMode double-effect, reconnect,
 *    re-render) cannot produce a second greeting;
 *  - `persist:roomMessages` persists the rooms map, so on the next page load
 *    the greeting comes back from storage with the SAME id and the pre-check
 *    below skips re-injecting it.
 */
const greetingId = (roomJID: string) => `ethora-widget-greeting:${roomJID}`;

/** Per-tab guard so concurrent callers cannot race each other. */
const injected = new Set<string>();

export function isGreetingMessageId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith('ethora-widget-greeting:');
}

export function registerGreeting({
  roomJID,
  text,
  botXmppUsername,
  botName,
  botAvatar,
}: GreetingInput): void {
  const body = (text || '').trim();
  if (!roomJID || !body || injected.has(roomJID)) return;
  // NB: `injected` is only marked once the room exists and the decision is
  // final, so the wait-for-room path below can safely re-enter.

  const state: any = store.getState();
  const room = state?.rooms?.rooms?.[roomJID];
  // The room must exist first (registerWidgetRoom injects it), otherwise the
  // reducer has nowhere to put the message and it is silently dropped.
  //
  // On a cold start it does NOT exist yet: provisioning, the SASL bind and the
  // MUC join all have to finish, and the panel sits on "Connecting..." for a
  // second or two. A single attempt at mount time therefore always lost the
  // race and the greeting never appeared. Wait for the room instead, the same
  // way registerWidgetRoom waits, and unsubscribe as soon as it lands.
  if (!room) {
    const unsubscribe = store.subscribe(() => {
      const s: any = store.getState();
      if (!s?.rooms?.rooms?.[roomJID]) return;
      unsubscribe();
      registerGreeting({ roomJID, text, botXmppUsername, botName, botAvatar });
    });
    return;
  }

  const messages: any[] = Array.isArray(room.messages) ? room.messages : [];
  // Only greet an untouched conversation. If real history exists, opening with
  // "Hi, how can I help?" above a week-old thread reads as a bug.
  const hasRealMessages = messages.some((m) => !isGreetingMessageId(m?.id));
  if (hasRealMessages) {
    injected.add(roomJID);
    return;
  }
  if (messages.some((m) => m?.id === greetingId(roomJID))) {
    injected.add(roomJID);
    return;
  }

  injected.add(roomJID);

  // One second back is enough to beat any human reply and small enough that
  // the timestamp still reads as "just now" in the bubble.
  const backdated = Date.now() - 1000;

  store.dispatch(
    addRoomMessage({
      roomJID,
      message: {
        id: greetingId(roomJID),
        body,
        roomJid: roomJID,
        // Backdated so the greeting always sorts above the visitor's first
        // reply, even if they answer instantly.
        //
        // It has to be set on ALL THREE fields. `compareMessageOrder` reads
        // `messageTimestampMs` when the key is present at all, and otherwise
        // falls back to `date` BEFORE `timestamp` - so backdating only
        // `timestamp` (the obvious choice) is silently ignored whenever
        // `date` is set, which it always is.
        messageTimestampMs: backdated,
        date: new Date(backdated).toISOString(),
        timestamp: backdated,
        user: {
          id: botXmppUsername,
          name: botName,
          profileImage: botAvatar || '',
        },
        // Not pending: a pending bubble renders the "sending" clock, and this
        // message is never going anywhere, so the clock would never clear.
        pending: false,
      } as any,
      start: false,
    } as any)
  );
}

/** Test seam: forget what has been injected in this tab. */
export const __resetGreetingGuard = () => injected.clear();
