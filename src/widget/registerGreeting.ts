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

  const state: any = store.getState();
  const room = state?.rooms?.rooms?.[roomJID];
  // The room must exist first (registerWidgetRoom injects it), otherwise the
  // reducer has nowhere to put the message and we would silently drop it.
  if (!room) return;

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

  store.dispatch(
    addRoomMessage({
      roomJID,
      message: {
        id: greetingId(roomJID),
        body,
        roomJid: roomJID,
        date: new Date().toISOString(),
        // Backdated by a second so it always sorts above the visitor's first
        // reply even when they answer immediately.
        timestamp: Date.now() - 1000,
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
