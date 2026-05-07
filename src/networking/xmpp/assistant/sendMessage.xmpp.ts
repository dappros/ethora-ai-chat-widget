import { Client, xml } from '@xmpp/client';

// AI Widget MUC variant: visitor + bot share a persistent MUC room
// (`${appId}_<roomUuid>@conference.<host>`) provisioned on session start
// by the platform. Messages flow as `groupchat` to the room JID, which
// also makes the conversation visible in the standard Ethora chat history
// stores (mod_mam + the platform-side `chats` collection) for operator
// review later — unlike the legacy `type:'chat'` 1:1 path, where only
// mod_mam saw the messages.
export const sendTextMessageAssistant = (
  client: Client,
  roomJID: string,
  userMessage: string,
  customId?: string
) => {
  const id =
    customId || `send-text-message-to-assistant-${Date.now().toString()}`;

  try {
    const message = xml(
      'message',
      {
        to: roomJID,
        type: 'groupchat',
        id: id,
      },
      xml('body', {}, userMessage)
    );
    client.send(message);
  } catch (error) {
    console.error('An error occurred while sending message:', error);
  }
};
