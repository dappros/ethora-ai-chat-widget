export { XmppProvider } from './context/xmppProvider';
export { ReduxWrapper as Chat } from './components/MainComponents/ReduxWrapper';
export { ReduxWrapper as AiAssistant } from './components/MainComponents/ReduxWrapper';
// Legacy 1:1 helper. Kept for back-compat with consumers that still mint
// client-side ephemeral creds; new MUC flow uses provisionWidgetSession
// (server-issued, app-prefixed visitor JID + persistent room).
export { createAnonymousXmppCredentials } from './utils/createAnonymousXmppCredentials';
// New MUC variant entry point. Admin preview + production embed both call
// this on mount: it POSTs to `${apiBase}/v2/widget/sessions`, persists the
// returned visitor envelope to localStorage, and returns the envelope
// shape needed to mount AiAssistant against the room.
export {
  provisionWidgetSession,
  __widgetSessionStorage,
} from './utils/provisionWidgetSession';
export type {
  WidgetVisitor,
  WidgetRoom,
  WidgetBot,
  WidgetSessionXmpp,
  WidgetSessionEnvelope,
} from './utils/provisionWidgetSession';
