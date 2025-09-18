import React, { FC, useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

interface CustomTypingIndicatorProps {
  usersTyping: string[];
  position?: 'bottom' | 'top' | 'overlay' | 'floating';
  styles?: React.CSSProperties;
  isVisible: boolean;
}

const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
`;

const BaseWrapper = styled.div<{ position: string }>`
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  z-index: 1000;
  transition: all 0.3s ease-in-out;
  letter-spacing: 0.5px;

  ${({ position }) => {
    switch (position) {
      case 'top':
        return `
          position: absolute;
          top: 8px;
          left: 16px;
          right: 16px;
          background: rgba(255, 255, 255, 0.95);
          padding: 8px 12px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
        `;
      case 'overlay':
        return `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 16px 24px;
          border-radius: 12px;
          animation: ${pulseAnimation} 2s infinite;
          backdrop-filter: blur(10px);
        `;
      case 'floating':
        return `
          position: fixed;
          bottom: 80px;
          right: 20px;
          background: rgba(255, 255, 255, 0.95);
          padding: 12px 16px;
          border-radius: 20px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(10px);
          animation: ${pulseAnimation} 2s infinite;
        `;
      case 'bottom':
      default:
        return `
          position: static;
          bottom: 4px;
          left: 16px;
          padding: 8px 0;
        `;
    }
  }}
`;

const GradientText = styled.span`
  background: linear-gradient(
    90deg,
    #00f5ff,
    #0070f3,
    #7928ca,
    #ff0080,
    #ff4d4d,
    #f9cb28
  );
  background-size: 400% 400%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShift 6s ease infinite;

  @keyframes gradientShift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
`;

const states = ['Thinking', 'Processing', 'Generating', 'Finalizing'];

const CustomTypingIndicator: FC<CustomTypingIndicatorProps> = ({
  usersTyping = [],
  position = 'bottom',
  styles = {},
  isVisible = true,
}) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % states.length);
    }, 2500); // 2.5 sec per word
    return () => clearInterval(interval);
  }, []);

  if (!isVisible || usersTyping.length === 0) return null;

  return (
    <BaseWrapper position={position} style={styles}>
      <GradientText>{states[index]}...</GradientText>
    </BaseWrapper>
  );
};

export default CustomTypingIndicator;
