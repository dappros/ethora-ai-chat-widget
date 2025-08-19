import React, { useMemo, useState } from 'react';
import { Provider } from 'react-redux';
import { store, persistor } from '../../roomStore';
import { ConfigUser, IConfig, MessageProps } from '../../types/types';
import '../../index.css';
import '../../helpers/storeConsole';
import LoginWrapper from './LoginWrapper.tsx';
import { PersistGate } from 'redux-persist/integration/react';
import Loader from '../styled/Loader.tsx';
import { ToastProvider } from '../../context/ToastContext.tsx';
import { FullScreenPopup, PopupHeaderButton } from './AssistantPopupStyles';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { AssistantChatWrapper } from './AssistantComponents.tsx/AssistantChatWrapper.tsx';
import {
  ETHO_ASSISTANT_MESSAGES,
  ETHO_ASSISTANT_USER,
} from '../../helpers/constants/ASSISTANT_LOCAL_STORAGE';
import { createAnonymousXmppCredentials } from '../../utils/createAnonymousXmppCredentials';
import {
  CloseSquareIcon,
  MaximizeSquareIcon,
  MinimizeSquareIcon,
} from '../../assets/icons.tsx';
import AssistantClosedButton from './AssistantComponents.tsx/AssistantClosedButton.tsx';

const ETHO_ASSISTANT_TIMESTAMP = 'ethora-assistant-timestamp';
const ASSISTANT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

interface ChatWrapperProps {
  token?: string;
  roomJID?: string;
  user?: ConfigUser;
  loginData?: { email: string; password: string };
  MainComponentStyles?: React.CSSProperties;
  CustomMessageComponent?: React.ComponentType<MessageProps>;
  config?: IConfig;
}

export const ReduxWrapper: React.FC<ChatWrapperProps> = React.memo(
  ({ ...props }) => {
    const memoizedConfig = useMemo(() => {
      if (props.config?.assistantMode) {
        const timestamp = window.localStorage.getItem(ETHO_ASSISTANT_TIMESTAMP);
        const now = Date.now();
        let expired = false;
        if (timestamp) {
          const created = parseInt(timestamp, 10);
          if (isNaN(created) || now - created > ASSISTANT_EXPIRY_MS) {
            expired = true;
          }
        } else {
          expired = true;
        }
        if (expired) {
          window.localStorage.removeItem(ETHO_ASSISTANT_USER);
          window.localStorage.removeItem(ETHO_ASSISTANT_MESSAGES);
          window.localStorage.removeItem(ETHO_ASSISTANT_TIMESTAMP);
        }
        let user = window.localStorage.getItem(ETHO_ASSISTANT_USER);
        if (!user) {
          const credentials = createAnonymousXmppCredentials();
          window.localStorage.setItem(
            ETHO_ASSISTANT_USER,
            JSON.stringify(credentials)
          );
          window.localStorage.setItem(ETHO_ASSISTANT_TIMESTAMP, now.toString());
          props.config.assistantMode.user = credentials;
        } else {
          props.config.assistantMode.user = JSON.parse(user);
        }
      }
      return props.config;
    }, [props.config]);

    if (memoizedConfig?.assistantMode) {
      const openStateKey =
        memoizedConfig.assistantOpenStateKey || 'assistantChatOpen';
      const { get, set } = useLocalStorage<boolean>(openStateKey);
      const [open, setOpen] = React.useState<boolean>(() => get() ?? false);

      React.useEffect(() => {
        set(open);
      }, [open]);

      const btnCfg = memoizedConfig.assistantButton || {};
      const popupCfg = memoizedConfig.assistantPopup || {};

      // Maximize state

      const [fullscreen, setFullscreen] = useState(false);
      // Animation state for mounting/unmounting
      const [showPopup, setShowPopup] = useState(open);

      React.useEffect(() => {
        if (open) {
          setShowPopup(true);
        } else {
          // Wait for animation before unmount
          const timeout = setTimeout(() => setShowPopup(false), 250);
          return () => clearTimeout(timeout);
        }
      }, [open]);

      return (
        <Provider store={store}>
          <ToastProvider>
            {!open && (
              <AssistantClosedButton icon={btnCfg.icon} onOpen={setOpen} />
            )}
            {showPopup && (
              <FullScreenPopup
                width={popupCfg.width || 300}
                height={popupCfg.height || 600}
                customStyle={popupCfg.style}
                style={btnCfg.position}
                fullscreen={fullscreen}
                data-open={open}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderBottom: '1px solid #eee',
                    background: '#1976d2',
                    color: '#fff',
                  }}
                >
                  <span>{memoizedConfig.chatLabel || 'AI Assistant'}</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <PopupHeaderButton
                      onClick={() => setFullscreen((f) => !f)}
                      aria-label={
                        fullscreen ? 'Minimize chat' : 'Maximize chat'
                      }
                      title={fullscreen ? 'Minimize' : 'Maximize'}
                    >
                      {fullscreen ? (
                        <MinimizeSquareIcon
                          style={{ width: '24px', height: '24px' }}
                        />
                      ) : (
                        <MaximizeSquareIcon
                          style={{ width: '24px', height: '24px' }}
                        />
                      )}
                    </PopupHeaderButton>
                    <PopupHeaderButton
                      onClick={() => setOpen(false)}
                      aria-label={popupCfg.closeButtonAriaLabel || 'Close chat'}
                      title="Close"
                    >
                      <CloseSquareIcon
                        style={{ width: '24px', height: '24px' }}
                      />
                    </PopupHeaderButton>
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <AssistantChatWrapper
                    config={memoizedConfig}
                    roomJID={props.roomJID}
                  />
                </div>
              </FullScreenPopup>
            )}
          </ToastProvider>
        </Provider>
      );
    }

    return (
      <Provider store={store}>
        <PersistGate loading={<Loader />} persistor={persistor}>
          <ToastProvider>
            <LoginWrapper config={memoizedConfig} {...props} />
          </ToastProvider>
        </PersistGate>
      </Provider>
    );
  }
);
