import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { AiChatIcon } from '../../../assets/icons';

type AssistantClosedButtonProps = {
  onOpen: React.Dispatch<React.SetStateAction<boolean>>;
  icon?: React.ReactNode;
  ariaLabel?: string;
};

const pulseGlow = keyframes`
  0% { box-shadow: 0 0 12px rgba(173, 29, 235, 0.4); }
  50% { box-shadow: 0 0 20px rgba(173, 29, 235, 0.8); }
  100% { box-shadow: 0 0 12px rgba(173, 29, 235, 0.4); }
`;

const fadeInOut = keyframes`
  0% { opacity: 0; transform: translateY(10px); }
  10% { opacity: 1; transform: translateY(0); }
  90% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-10px); }
`;

const ChatLauncher = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #6e72fc, #ad1deb);
  box-shadow: 0 0 12px rgba(173, 29, 235, 0.4);
  font-size: 24px;
  color: white;
  cursor: pointer;
  animation: ${pulseGlow} 2.5s infinite;
  transition: transform 0.2s ease;
  z-index: 9999;

  &:hover {
    transform: scale(1.05);
  }
`;

const fadeBounce = keyframes`
  0%   { opacity: 0; transform: translateY(-3px); }
  10%  { opacity: 1; transform: translateY(-1px); }
  50%  { opacity: 1; transform: translateY(1px); }
  90%  { opacity: 1; transform: translateY(3px); }
  100% { opacity: 0; transform: translateY(1); }
`;

const ChatTooltip = styled.div`
  position: fixed;
  bottom: 90px;
  right: 24px;
  background: #ffffff;
  color: #333;
  padding: 10px 14px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  font-size: 14px;
  animation: ${fadeBounce} 5s ease forwards;
  z-index: 9998;
`;

const AssistantClosedButton: React.FC<AssistantClosedButtonProps> = ({
  onOpen,
  icon,
  ariaLabel = 'Open chat',
}) => {
  const [showTooltip, setShowTooltip] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <ChatLauncher aria-label={ariaLabel} onClick={() => onOpen(true)}>
        {icon || <AiChatIcon style={{ width: '32px', height: '32px' }} />}
      </ChatLauncher>
      {showTooltip && <ChatTooltip>✨ Ask me anything!</ChatTooltip>}
    </>
  );
};

export default AssistantClosedButton;
