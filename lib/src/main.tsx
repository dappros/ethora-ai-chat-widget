import React from 'react';
import ReactDOM from 'react-dom/client';
import AssistantTest from './AssistantTest.tsx';
import './index.css';

const BOT_ID_STORAGE_KEY = 'ethora-assistant-bot-id';
const PERSIST_ROOT_KEY = 'persist:root';
const PERSIST_CHAT_SETTINGS_KEY = 'chatSettingStore';
const PERSIST_ROOMS_KEY = 'roomMessages';
const PERSIST_ASSISTANT_SLICE_KEY = 'assistanRoomSlice';
const ASSISTANT_USER_KEY = 'ethora-assistant-user';
const ASSISTANT_MESSAGES_KEY = 'ethora-assistant-messages';
const ASSISTANT_TIMESTAMP_KEY = 'ethora-assistant-timestamp';
const ASSISTANT_OPEN_STATE_KEYS = ['EthoraAssistantOpen', 'assistantChatOpen'];

function clearStorageForNewBot(newBotId?: string) {
  if (!newBotId) return;
  const previousBotId = window.localStorage.getItem(BOT_ID_STORAGE_KEY);
  if (previousBotId && previousBotId === newBotId) return;

  try {
    window.localStorage.removeItem(ASSISTANT_USER_KEY);
    window.localStorage.removeItem(ASSISTANT_MESSAGES_KEY);
    window.localStorage.removeItem(ASSISTANT_TIMESTAMP_KEY);
    ASSISTANT_OPEN_STATE_KEYS.forEach((k) => window.localStorage.removeItem(k));

    window.localStorage.removeItem(PERSIST_ROOT_KEY);
    window.localStorage.removeItem(PERSIST_CHAT_SETTINGS_KEY);
    window.localStorage.removeItem(PERSIST_ROOMS_KEY);
    window.localStorage.removeItem(PERSIST_ASSISTANT_SLICE_KEY);
  } catch (e) {
    console.warn('Failed to clear storage on bot change', e);
  }

  window.localStorage.setItem(BOT_ID_STORAGE_KEY, newBotId);
}

function mountChatAssistant(container: HTMLElement, botId?: string) {
  ReactDOM.createRoot(container).render(<AssistantTest botId={botId} />);
}

function createChatWidgetDiv(): HTMLDivElement {
  const chatWidgetContainer = document.createElement('div');
  chatWidgetContainer.id = 'chat-widget';
  return chatWidgetContainer;
}

function waitForBodyAndMount() {
  if (!document.body) {
    setTimeout(waitForBodyAndMount, 10);
    return;
  }

  const existing = document.getElementById('chat-widget');
  if (existing) return;

  const scriptTag = document.getElementById('chat-content-assistant');
  const botId = scriptTag?.getAttribute('data-bot-id') || undefined;

  clearStorageForNewBot(botId);

  const chatWidgetContainer = createChatWidgetDiv();
  document.body.appendChild(chatWidgetContainer);
  mountChatAssistant(chatWidgetContainer, botId);
}

waitForBodyAndMount();
