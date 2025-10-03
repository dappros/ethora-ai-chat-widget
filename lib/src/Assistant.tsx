import { ReduxWrapper } from './components/MainComponents/ReduxWrapper';
import { XmppProvider } from './main';
import { IConfig } from './types/types';
import { createAnonymousXmppCredentials } from './utils/createAnonymousXmppCredentials';

const assistantChatConfig: IConfig = {
  colors: { primary: '#1976d2', secondary: '#E1E4FE' },
  assistantButton: {
    position: { right: 24, bottom: 24 },
    ariaLabel: 'Open assistant chat',
  },
  assistantPopup: {
    width: 320,
    height: 520,
    style: { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
    closeButtonAriaLabel: 'Close assistant chat',
  },
  assistantOpenStateKey: 'EthoraAssistantOpen',
  disableMedia: true,
  disableInteractions: true,
  disableRooms: true,
  xmppSettings: {
    devServer: 'wss://xmpp.ethoradev.com:5443/ws',
    host: 'xmpp.ethoradev.com',
    conference: 'conference.xmpp.ethoradev.com',
  },
};

export default function Assistant({
  botId,
  botAvatar,
  botDisplayName,
}: {
  botId?: string;
  botAvatar?: string;
  botDisplayName?: string;
}) {
  const user = createAnonymousXmppCredentials();
  return (
    <XmppProvider>
      <ReduxWrapper
        roomJID={botId}
        config={{
          ...assistantChatConfig,
          assistantMode: { enabled: true, user },
          botAvatar,
          botDisplayName,
        }}
      />
    </XmppProvider>
  );
}

// export default function Assistant() {
//   const user = createAnonymousXmppCredentials();
//   return (
//     <XmppProvider>
//       <ReduxWrapper
//         roomJID={
//           '685a6b13db443b01282ab755_685a6b13db443b01282ab763-bot@xmpp.ethoradev.com'
//         }
//         config={{
//           ...assistantChatConfig,
//           assistantMode: { enabled: true, user },
//         }}
//       />
//     </XmppProvider>
//   );
// }
// uncomment to test with npm run dev
