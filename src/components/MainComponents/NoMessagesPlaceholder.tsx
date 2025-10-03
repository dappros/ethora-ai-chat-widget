import React from 'react';
import { NoMessages } from '../../assets/icons';

interface NoMessagesPlaceholderProps {
  assistantName?: string;
}

const NoMessagesPlaceholder: React.FC<NoMessagesPlaceholderProps> = ({
  assistantName,
}) => {
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
          <div style={{ fontSize: '16px', fontWeight: 600 }}>
            Write a question
          </div>
          <div style={{ fontSize: '14px', fontWeight: 400 }}>
            {assistantName ?? 'Our AI Assistant'} will be happy to help
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoMessagesPlaceholder;
