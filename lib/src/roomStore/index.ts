import { configureStore, combineReducers, Reducer } from '@reduxjs/toolkit';
import chatSettingsReducer from './chatSettingsSlice';
import roomsSlice from './roomsSlice';
import roomHeapSlice from './roomHeapSlice';
import { IRoom } from '../types/types';
import { unreadMiddleware } from './Middleware/unreadMidlleware';
import storage from 'redux-persist/lib/storage';
import { persistReducer, persistStore } from 'redux-persist';
import { createTransform } from 'redux-persist';
import { AnyAction } from 'redux-saga';
import { logoutMiddleware } from './Middleware/logoutMiddleware';
import { encryptTransform } from 'redux-persist-transform-encrypt';
import { ETHORA_CHAT_COMPONENT_VERSION } from '../version';
import {
  assistanRoomSlice,
  normalizeAssistantMessages,
  RoomMessagesState,
} from './assistantMessageSlice';

const limitMessagesTransform = createTransform(
  (inboundState: { [jid: string]: IRoom }) => {
    if (!inboundState || Object.keys(inboundState).length < 1) {
      return inboundState;
    }

    const rooms = { ...inboundState };
    for (const jid in rooms) {
      if (rooms[jid]?.messages?.length > 50) {
        rooms[jid] = {
          ...rooms[jid],
          messages: rooms[jid].messages.slice(-50),
        };
      }
    }
    return { ...rooms };
  },

  (outboundState: { [jid: string]: IRoom }) => outboundState
);

const encryptor = encryptTransform({
  secretKey: 'hey-this-is-dappros',
  onError: (error) => {
    console.error('Encryption error:', error);
  },
});

const chatSettingPersistConfig = {
  key: 'chatSettingStore',
  storage,
  blacklist: [
    'activeModal',
    'deleteModal',
    'selectedUser',
    'activeFile',
    'config.refreshTokens',
    'refreshTokens',
    'client',
  ],
  transforms: [encryptor],
};

const roomsPersistConfig = {
  key: 'roomMessages',
  storage,
  blacklist: ['editAction', 'activeRoomJID', 'loadingText'],
  transforms: [limitMessagesTransform],
};

const sanitizeAssistantMessagesTransform = createTransform(
  (inboundState: RoomMessagesState) => ({
    ...inboundState,
    messages: normalizeAssistantMessages(inboundState?.messages),
  }),
  (outboundState: RoomMessagesState) => ({
    ...outboundState,
    messages: normalizeAssistantMessages(outboundState?.messages),
  })
);

const assistantMessageSlicePersistConfig = {
  key: 'assistanRoomSlice',
  storage,
  transforms: [sanitizeAssistantMessagesTransform, limitMessagesTransform],
};

const rootReducer = combineReducers({
  chatSettingStore: persistReducer(
    chatSettingPersistConfig,
    chatSettingsReducer
  ),
  rooms: persistReducer(roomsPersistConfig, roomsSlice),
  assistantMessageSlicePersistConfig: persistReducer(
    assistantMessageSlicePersistConfig,
    assistanRoomSlice.reducer
  ),
  roomHeapSlice,
});

export type RootState = ReturnType<typeof rootReducer>;

// Keep persistence scoped to the slices that actually need it. Persisting the
// already-persisted root state again can rehydrate stale nested data and breaks
// the encrypt transform because it receives objects instead of strings.
const persistedReducer: Reducer<RootState, AnyAction> =
  rootReducer as Reducer<RootState, AnyAction>;

export const getActiveRoom = (state: RootState): IRoom | null => {
  const roomMessagesState = state.rooms;
  return roomMessagesState.activeRoomJID
    ? roomMessagesState.rooms[roomMessagesState.activeRoomJID]
    : null;
};

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: true,
      serializableCheck: {
        ignoredActions: [
          'chat/addMessage',
          'persist/PERSIST',
          'persist/REHYDRATE',
        ],
        ignoredPaths: [
          'chat.messages.timestamp',
          'chatSettingStore.client',
          'chatSettingStore.config',
        ],
      },
    }).concat(logoutMiddleware),
  // .concat(testMiddleware)
  // .concat(debugMiddleware)
  // .concat(actionLoggerMiddleware),
});

export type AppDispatch = typeof store.dispatch;

export const persistor = persistStore(store);

try {
  console.log('[EthoraChatComponent] version:', ETHORA_CHAT_COMPONENT_VERSION);
} catch (e) {}
