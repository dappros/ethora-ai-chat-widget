// Single-bot room registration.
//
// chat-component's <Chat> renders the multi-room model: a conversation shows
// only when its room exists in the redux `rooms` map. That map is normally
// populated from `GET /chats/my` (needs an API token) or the XMPP room-list
// IQ (`getRoomsStanza`). The widget visitor has NO API token, and the
// server's room-list IQ does NOT surface the freshly-provisioned widget MUC
// room — so the chat would sit on "No room" forever even though we already
// KNOW the room JID from the session envelope.
//
// Because the widget builds chat-component from SOURCE, the shell and the
// library share ONE redux store singleton. So we register the known room
// directly via the slice's own actions — no chat-component edits, no token,
// no dependence on the room-list IQ. The MUC join + history then flow through
// chat-component's normal `defaultRooms` presence + active-room history path.
import { store } from '@ethora/chat-component/roomStore';
import {
  addRoomFromApi,
  setCurrentRoom,
} from '@ethora/chat-component/roomStore/roomsSlice';
import type { ResolvedSession } from './resolveSession';

export function registerWidgetRoom(session: ResolvedSession): void {
  const { roomJID, persona } = session;
  if (!roomJID) return;

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

  store.dispatch(addRoomFromApi({ room }));
  store.dispatch(setCurrentRoom({ roomJID }));
}
