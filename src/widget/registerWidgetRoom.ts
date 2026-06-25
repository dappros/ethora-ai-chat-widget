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
  setCurrentRoom,
} from '@ethora/chat-component/roomStore/roomsSlice';
import type { ResolvedSession } from './resolveSession';

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
  };

  ensure();
  store.subscribe(ensure);
}
