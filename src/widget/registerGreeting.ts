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
  roomCreatedAt?: string | null;
  chatId?: string;
}

/**
 * Deterministic id. Two things depend on it:
 *  - the slice dedupes by id, so a re-run (StrictMode double-effect, reconnect,
 *    re-render) cannot produce a second greeting;
 *  - the pre-check skips re-injecting a greeting already in the room.
 */
const greetingId = (roomJID: string) => `ethora-widget-greeting:${roomJID}`;

/** Per-tab guard so concurrent callers cannot race each other. */
const injected = new Set<string>();
const subscriptions = new Map<string, () => void>();

export function isGreetingMessageId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith('ethora-widget-greeting:');
}

export function registerGreeting({
  roomJID,
  text,
  botXmppUsername,
  botName,
  botAvatar,
  roomCreatedAt,
  chatId,
}: GreetingInput): void {
  const body = (text || '').trim();
  if (!roomJID || !body) return;
  // One SUBSCRIPTION per room, not one injection per room. The greeting kept
  // vanishing right after it appeared: the MAM history sync lands a moment
  // after the MUC join, and for a fresh widget room the server's history is
  // empty - the merge replaced the room's messages and wiped the local bubble.
  // Keep it present across history syncs, with a stable id to prevent duplicates.
  if (injected.has(roomJID)) return;
  injected.add(roomJID);

  const inject = () => {
    // Backdated so the greeting sorts above the visitor's first reply. Must
    // be on all three fields: compareMessageOrder prefers messageTimestampMs,
    // then date, then timestamp.
    //
    // A flat "now - 1000" is not enough on its own. chat-component's
    // ChatRoom captures `lastViewedTimestamp` (the read-marker used to place
    // the "New Messages" divider) at mount time, essentially "now" too - and
    // this injection can land more than 1s AFTER that mount (XMPP connect,
    // MUC join, persona/greeting resolve all happen first). When that lag
    // exceeds 1s, the greeting ends up newer than the stored read-marker even
    // though it is backdated. That inconsistency is invisible at first, but
    // the next time chat-component re-applies a read-marker (e.g. the
    // routine private-store resync on connect, nothing to do with an actual
    // error), normalizeDelimiterPosition finds the greeting as "unread"
    // relative to the stale marker and splices a "New Messages" divider
    // directly above it - the greeting bubble visually drops down a row,
    // looking exactly like "the greeting moved lower after the first reply".
    // Fix: never let the greeting be newer than anything already known about
    // this room (its own read-marker included), not just newer than "now".
    const s2: any = store.getState();
    const room = s2?.rooms?.rooms?.[roomJID];
    const knownMessages: any[] = room && Array.isArray(room.messages)
      ? room.messages
      : [];
    const knownTimestamps: number[] = [];
    for (const m of knownMessages) {
      const t =
        Number(m?.messageTimestampMs) ||
        Number(m?.timestamp) ||
        Date.parse(m?.date || '') ||
        0;
      if (t > 0) knownTimestamps.push(t);
    }
    const lastViewed = Number(room?.lastViewedTimestamp) || 0;
    if (lastViewed > 0) knownTimestamps.push(lastViewed);
    // The room predates every message. Older API versions omit createdAt,
    // but Mongo ObjectIds encode their creation time in the first four bytes.
    const created = roomCreatedAt ? Date.parse(roomCreatedAt) : 0;
    const objectIdTime = chatId && /^[a-f\d]{24}$/i.test(chatId)
      ? parseInt(chatId.slice(0, 8), 16) * 1000
      : 0;
    const roomStart = Number.isFinite(created) && created > 0 ? created : objectIdTime;
    if (roomStart > 0) knownTimestamps.push(roomStart);
    let backdated = Date.now() - 1000;
    if (knownTimestamps.length) {
      backdated = Math.min(backdated, Math.min(...knownTimestamps) - 1000);
    }
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
      start: true,
    } as any)
  );
  };

  const ensure = () => {
    const s2: any = store.getState();
    const room = s2?.rooms?.rooms?.[roomJID];
    if (!room) return;
    const messages: any[] = Array.isArray(room.messages) ? room.messages : [];
    if (messages.some((m) => m?.id === greetingId(roomJID))) return;
    inject();
  };

  subscriptions.set(roomJID, store.subscribe(ensure));
  ensure();
  // Debug hook: lets a host page inspect the engine store the widget runs on.
  try {
    (window as any).__ethoraStore = store;
  } catch {
    // ignore
  }
}

/** Release room listeners when the widget is destroyed or reset. */
export function clearGreetingSubscriptions(): void {
  subscriptions.forEach((unsubscribe) => unsubscribe());
  subscriptions.clear();
  injected.clear();
}

/** Test seam: forget what has been injected in this tab. */
export const __resetGreetingGuard = clearGreetingSubscriptions;
