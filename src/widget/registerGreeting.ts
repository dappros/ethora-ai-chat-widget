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
  if (!roomJID || !body) return;
  // One SUBSCRIPTION per room, not one injection per room. The greeting kept
  // vanishing right after it appeared: the MAM history sync lands a moment
  // after the MUC join, and for a fresh widget room the server's history is
  // empty - the merge replaced the room's messages and wiped the local bubble.
  // So, like registerWidgetRoom, keep a store subscription that re-asserts the
  // greeting whenever the room exists and holds no real conversation. The
  // guards make every pass a no-op once the greeting is present or the visitor
  // has actually spoken, so it converges instead of looping.
  if (injected.has(roomJID)) return;
  injected.add(roomJID);

  const inject = () => {
    // Backdated so the greeting sorts above the visitor's first reply. Must
    // be on all three fields: compareMessageOrder prefers messageTimestampMs,
    // then date, then timestamp.
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
  };

  const ensure = () => {
    const s2: any = store.getState();
    const room = s2?.rooms?.rooms?.[roomJID];
    if (!room) return;
    const messages: any[] = Array.isArray(room.messages) ? room.messages : [];
    // The visitor (or the bot) has really spoken: the greeting's job is done
    // for good, even if it was itself wiped. Stop watching.
    if (messages.some((m) => !isGreetingMessageId(m?.id))) {
      unsubscribe?.();
      return;
    }
    if (messages.some((m) => m?.id === greetingId(roomJID))) return;
    inject();
  };

  let unsubscribe: (() => void) | null = null;
  unsubscribe = store.subscribe(ensure);
  ensure();
}

/** Test seam: forget what has been injected in this tab. */
export const __resetGreetingGuard = () => injected.clear();
