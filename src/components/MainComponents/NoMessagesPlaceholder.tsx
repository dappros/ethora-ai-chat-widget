import { NoMessages } from '../../assets/icons';
import { useChatSettingState } from '../../hooks/useChatSettingState';

const NoMessagesPlaceholder = () => {
  // Greeting copy is configurable per embed (data-greeting-title /
  // data-greeting on the script tag), with the active Agent's
  // displayName injected into the default message via AssistantTest's
  // resolution chain. We read the resolved values straight from
  // config so this component stays presentation-only.
  const { config } = useChatSettingState();
  const title = config?.greetingTitle || 'Write a question';
  const message =
    config?.greetingMessage || 'Our AI Assistant will be happy to help';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <NoMessages />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 16,
            justifyContent: 'center',
            textAlign: 'center',
            color: '#000',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: '14px', fontWeight: 400 }}>{message}</div>
        </div>
      </div>
    </div>
  );
};

export default NoMessagesPlaceholder;
