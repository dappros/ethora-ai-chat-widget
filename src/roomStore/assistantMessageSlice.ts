import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AddRoomMessageAction, IMessage } from '../types/types';
import { insertMessageWithDelimiter } from '../helpers/insertMessageWithDelimiter';
import { ETHO_ASSISTANT_MESSAGES } from '../helpers/constants/ASSISTANT_LOCAL_STORAGE';
import { addMessageToHeap } from './roomHeapSlice';

export interface RoomMessagesState {
  isLoading: boolean;
  messages: { [roomJID: string]: IMessage[] };
  jid: string;
  loadingText?: string;
  composing?: { [roomJID: string]: boolean };
}

const initialState: RoomMessagesState = {
  isLoading: false,
  loadingText: undefined,
  messages: {},
  composing: {},
  jid: '',
};

export const normalizeAssistantMessages = (
  messages: unknown
): { [roomJID: string]: IMessage[] } => {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) {
    return {};
  }

  const normalizedMessages: { [roomJID: string]: IMessage[] } = {};

  Object.entries(messages as Record<string, unknown>).forEach(
    ([roomJID, roomMessages]) => {
      if (Array.isArray(roomMessages)) {
        normalizedMessages[roomJID] = roomMessages.filter(
          (message): message is IMessage =>
            Boolean(message) && typeof message === 'object'
        );
      }
    }
  );

  return normalizedMessages;
};

const saveMessagesToLocalStorage = (messages: {
  [roomJID: string]: IMessage[];
}) => {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filteredMessages: { [roomJID: string]: IMessage[] } = {};

  const normalizedMessages = normalizeAssistantMessages(messages);

  for (const roomJID in normalizedMessages) {
    if (Object.prototype.hasOwnProperty.call(normalizedMessages, roomJID)) {
      filteredMessages[roomJID] = normalizedMessages[roomJID].filter(
        (message) => (message.timestamp || 0) > thirtyDaysAgo
      );
    }
  }

  window.localStorage.setItem(
    ETHO_ASSISTANT_MESSAGES,
    JSON.stringify(filteredMessages)
  );
};

export const assistanRoomSlice = createSlice({
  name: 'assistanRoomSlice',
  initialState,
  reducers: {
    initRoomMessages(state) {
      const savedMessages = window.localStorage.getItem(
        ETHO_ASSISTANT_MESSAGES
      );
      if (savedMessages) {
        try {
          state.messages = normalizeAssistantMessages(JSON.parse(savedMessages));
        } catch (error) {
          state.messages = {};
          window.localStorage.removeItem(ETHO_ASSISTANT_MESSAGES);
        }
      }
    },
    setJid(state, action: PayloadAction<{ roomJID: string }>) {
      const { roomJID } = action.payload;
      state.jid = roomJID;
    },
    setRoomMessages(
      state,
      action: PayloadAction<{ roomJID: string; messages: IMessage[] }>
    ) {
      const { roomJID, messages } = action.payload;
      state.messages[roomJID] = Array.isArray(messages) ? messages : [];
      saveMessagesToLocalStorage(state.messages);
    },
    deleteRoomMessage(
      state,
      action: PayloadAction<{ roomJID: string; messageId: string }>
    ) {
      const { roomJID, messageId } = action.payload;
      if (state.messages[roomJID]) {
        state.messages[roomJID] = state.messages[roomJID].filter(
          (message) => message.id !== messageId
        );
        saveMessagesToLocalStorage(state.messages);
      }
    },
    addRoomMessage(state, action: PayloadAction<AddRoomMessageAction>) {
      const { roomJID, message, start } = action.payload;
      if (!message?.body) return;

      if (!state.messages[roomJID]) {
        state.messages[roomJID] = [];
      }

      const roomMessages = state.messages[roomJID];

      const existingIndex = roomMessages.findIndex(
        (msg) =>
          msg.id === message.id ||
          (message.xmppId && msg.id === message.xmppId) ||
          (msg.xmppId && msg.xmppId === message.id)
      );

      if (existingIndex !== -1) {
        roomMessages[existingIndex] = {
          ...roomMessages[existingIndex],
          ...message,
          pending: false,
          timestamp: message.timestamp || Date.now(),
        };
        saveMessagesToLocalStorage(state.messages);
        return;
      }

      const messageWithTimestamp = { ...message, timestamp: Date.now() };

      if (roomMessages.length === 0 || start) {
        const index = roomMessages.findIndex(
          (msg) => msg.id === message.xmppId || msg.id === message.id
        );
        if (index !== -1) {
          roomMessages[index] = {
            ...messageWithTimestamp,
            id: message.id,
            pending: false,
          };
        } else {
          roomMessages.unshift(messageWithTimestamp);
        }
      } else {
        insertMessageWithDelimiter(roomMessages, messageWithTimestamp);
      }

      saveMessagesToLocalStorage(state.messages);
    },
    setComposing(
      state,
      action: PayloadAction<{
        chatJID: string;
        composing: boolean;
        composingList?: string[];
      }>
    ) {
      const { chatJID, composing } = action.payload;
      if (!state.composing) state.composing = {};
      state.composing[chatJID] = composing;
    },
    setIsLoading: (
      state,
      action: PayloadAction<{
        chatJID?: string;
        loading: boolean;
        loadingText?: string;
      }>
    ) => {
      //   const { chatJID, loading, loadingText } = action.payload;
      //   if (chatJID && state.messages) {
      //     state.messages = loading;
      //   }
      //   if (!chatJID) {
      //     state.isLoading = loading;
      //   }
      //   if (loadingText) {
      //     state.loadingText = loadingText;
      //   }
    },
  },
});

export const {
  initRoomMessages,
  setRoomMessages,
  addRoomMessage,
  deleteRoomMessage,
  setComposing,
  setIsLoading,
  setJid,
} = assistanRoomSlice.actions;

export default assistanRoomSlice.reducer;
