import styled, { css, keyframes } from 'styled-components';
import { AssistantChatPopup } from '../styled/StyledComponents';

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95) translateY(40px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const fadeOut = keyframes`
  from { opacity: 1; transform: scale(1) translateY(0); }
  to { opacity: 0; transform: scale(0.95) translateY(40px); }
`;

export const FullScreenPopup = styled(AssistantChatPopup)<{ fullscreen: boolean }>`
  animation: ${fadeIn} 0.25s cubic-bezier(0.4,0,0.2,1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  &[data-open='false'] {
    animation: ${fadeOut} 0.25s cubic-bezier(0.4,0,0.2,1) forwards;
    pointer-events: none;
  }
  ${({ fullscreen }) =>
    fullscreen &&
    css`
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      border-radius: 0 !important;
      z-index: 9999 !important;
      margin: 0 !important;
      box-shadow: none !important;
    `}
`;

export const PopupHeaderButton = styled.button`
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.2s;
  &:hover {
    color: #90caf9;
  }
  padding: 0px;
`;
