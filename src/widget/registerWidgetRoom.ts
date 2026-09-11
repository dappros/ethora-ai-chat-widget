// Single-bot room registration.
//
// chat-component's <Chat> renders the multi-room model: a conversation shows
// only when its room exists in the redux `rooms` map. That map is normally
// populated from `GET /chats/my` (needs an API token) or the XMPP room-list
// IQ (`getRoomsStanza`). The widget visitor has NO API token, and the
// server's room-list IQ does NOT surface the freshly-provisioned widget MUC
// room - so the chat would sit on "No room" forever even though we already
// KNOW the room JID from the session envelope.
//
// Because the widget builds chat-component from SOURCE, the shell and the
// library share ONE redux store singleton. So we register the known room
// directly via the slice's own actions - no chat-component edits, no token,
// no dependence on the room-list IQ.
//
// We do this as a self-healing store subscription: the room is (re-)injected
// whenever it goes missing or stops being the active room. This survives the
// races that otherwise produce an intermittent "No room": redux-persist
// rehydration clobbering the map (empty after a storage clear), and any init /
// reconnect reset. The guards (only dispatch when actually missing/wrong) make
// it converge immediately and never loop.
import { store } from '@ethora/chat-component/roomStore';
import {
  addRoom,
  insertUsers,
  setCurrentRoom,
} from '@ethora/chat-component/roomStore/roomsSlice';
import type { ResolvedSession } from './resolveSession';
import { isGreetingMessageId } from './registerGreeting';

// Guard so a given room is wired exactly once (Assistant may re-run the effect).
const registered = new Set<string>();

export function registerWidgetRoom(session: ResolvedSession): void {
  const { roomJID, persona } = session;
  if (!roomJID || registered.has(roomJID)) return;
  registered.add(roomJID);

  // Minimal IRoom; chat-component fills the rest from XMPP (occupants,
  // history, subject) once it joins the MUC.
  const room: any = {
    jid: roomJID,
    name: persona.botName,
    title: persona.title,
    usersCnt: 0,
    members: [],
    messages: [],
    isLoading: false,
    unreadMessages: 0,
    historyPreloadState: 'idle',
  };

  // One identity for the bot, everywhere it appears.
  //
  // The widget persona (header, greeting) and the bot's own messages used to
  // read the bot's name from two different backend records: the session
  // envelope carries the Agent's displayName, while the bot stamps its
  // BotInstance name onto every stanza it sends. Whenever the two differed
  // the same conversation showed the bot under two names.
  //
  // chat-component resolves a bubble's name and avatar from `usersSet` first
  // (keyed by xmpp username) and falls back to the stanza only when the user
  // is missing. For a widget visitor it always is missing - the profile
  // lookup needs an API token the visitor does not have - so registering the
  // bot there once makes every bubble, greeting included, agree.
  const botKey = persona.botXmppUsername;
  const botMember = (name: string) => ({
    _id: botKey,
    xmppUsername: botKey,
    firstName: name,
    lastName: '',
    ...(persona.botAvatar ? { profileImage: persona.botAvatar } : {}),
  });
  const ensureBotIdentity = (rooms: any) => {
    if (!botKey) return;
    const existing = rooms.usersSet?.[botKey];
    if (persona.botNameExplicit) {
      // A chosen name (data-bot-name, or the Agent's displayName) wins over
      // whatever the bot calls itself. Compared field by field so the store
      // subscription converges instead of dispatching forever.
      if (
        !existing ||
        existing.firstName !== persona.botName ||
        existing.lastName !== '' ||
        (existing.profileImage || '') !== (persona.botAvatar || '')
      ) {
        store.dispatch(insertUsers({ newUsers: [botMember(persona.botName)] }));
      }
      return;
    }
    // Nothing chosen: the generic fallback must not overwrite the bot's real
    // name, so adopt the name from the bot's first real message instead. The
    // greeting (and the header, see Assistant) then follow it.
    if (existing) return;
    const messages: any[] = rooms.rooms?.[roomJID]?.messages || [];
    const own = messages.find(
      (m) =>
        m?.user?.id === botKey &&
        !isGreetingMessageId(m.id) &&
        m.isSystemMessage !== true &&
        m.isSystemMessage !== 'true' &&
        String(m.user?.name || '').trim()
    );
    if (own) {
      store.dispatch(
        insertUsers({ newUsers: [botMember(String(own.user.name).trim())] })
      );
    }
  };

  const ensure = () => {
    const state: any = store.getState();
    const rooms = state?.rooms;
    if (!rooms) return;
    if (!rooms.rooms || !rooms.rooms[roomJID]) {
      store.dispatch(addRoom({ roomData: room }));
    }
    if (rooms.activeRoomJID !== roomJID) {
      store.dispatch(setCurrentRoom({ roomJID }));
    }
    ensureBotIdentity(rooms);
  };

  ensure();
  store.subscribe(ensure);
}
