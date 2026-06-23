import React from 'react';
import ReactDOM from 'react-dom/client';
import { StyleSheetManager } from 'styled-components';
import Assistant from './Assistant.tsx';
import { setBaseURL } from './networking/apiClient';
import { VITE_APP_API_URL } from './config';

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

function mountChatAssistant(
  container: HTMLElement,
  botId?: string,
  botAvatar?: string,
  botDisplayName?: string,
  styleTarget?: HTMLStyleElement,
  apiUrl?: string
) {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <StyleSheetManager target={styleTarget}>
        <Assistant
          botId={botId}
          botAvatar={botAvatar}
          botDisplayName={botDisplayName}
          apiUrl={apiUrl}
        />
      </StyleSheetManager>
    </React.StrictMode>
  );
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
  const botAvatar = scriptTag?.getAttribute('data-bot-avatar') || undefined;
  const botDisplayName =
    scriptTag?.getAttribute('data-bot-display-name') || undefined;
  // Optional override of the Ethora API base URL. Defaults to Ethora Cloud
  // (https://api.chat.ethora.com/v1). Set data-api-url on the embed script to
  // point the widget at a self-hosted / dedicated Ethora server.
  const apiUrl =
    scriptTag?.getAttribute('data-api-url')?.trim() || VITE_APP_API_URL;

  // Apply the override to the shared HTTP client before the app mounts so the
  // very first requests already use the correct base URL.
  setBaseURL(apiUrl);

  clearStorageForNewBot(botId);

  const chatWidgetContainer = createChatWidgetDiv();
  document.body.appendChild(chatWidgetContainer);
  const shadow = chatWidgetContainer.attachShadow({ mode: 'open' });

  const styleTarget = document.createElement('style');
  shadow.appendChild(styleTarget);

  const shadowAppRoot = document.createElement('div');
  shadow.appendChild(shadowAppRoot);

  mountChatAssistant(
    shadowAppRoot,
    botId,
    botAvatar,
    botDisplayName,
    styleTarget,
    apiUrl
  );
}

waitForBodyAndMount();
