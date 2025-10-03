import React, { useEffect, useState } from 'react';
// Removed ContextMenuComponents; reimplement minimal inline elements
const Overlay: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => (
  <div {...props} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
);
const ContainerInteractions: React.FC<React.HTMLAttributes<HTMLDivElement>> = (
  props
) => (
  <div
    {...props}
    style={{
      position: 'fixed',
      zIndex: 1000,
      background: '#fff',
      borderRadius: 8,
    }}
  />
);
const ContextMenu: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => (
  <div
    {...props}
    style={{
      padding: 8,
      minWidth: 160,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}
  />
);
const MenuItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = (props) => (
  <div
    {...props}
    style={{
      padding: '6px 10px',
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      cursor: 'pointer',
    }}
  />
);
const Delimeter: React.FC = () => (
  <div style={{ height: 1, background: '#eaeaea', margin: '4px 0' }} />
);
const ReactionContainer: React.FC<React.HTMLAttributes<HTMLDivElement>> = (
  props
) => <div {...props} style={{ display: 'flex', padding: 6 }} />;
const ArrowButton: React.FC<
  { isRotated?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ isRotated, ...rest }) => (
  <button
    {...rest}
    style={{
      transform: isRotated ? 'rotate(180deg)' : 'none',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
    }}
  />
);
import { useSelector } from 'react-redux';
import { RootState } from '../../roomStore';
import {
  MESSAGE_INTERACTIONS,
  MESSAGE_INTERACTIONS_ICONS,
} from '../../helpers/constants/MESSAGE_INTERACTIONS';
import { IMessage } from '../../types/types';
import { DownArrowIcon } from '../../assets/icons';

import '../../index.css';

const fixedEmojiIds = ['joy', 'heart', 'fire', '+1', 'smile', 'scream'];
import { useRoomState } from '../../hooks/useRoomState';

interface MessageInteractionsProps {
  isReply?: boolean;
  isUser?: boolean;
  message: IMessage;
  contextMenu: { visible: boolean; x: number; y: number };
  setContextMenu: ({ visible, x, y }) => void;
  handleReplyMessage: () => void;
  handleDeleteMessage: () => void;
  handleEditMessage: () => void;
  handleReactionMessage: (reaction) => void;
}

const MessageInteractions: React.FC<MessageInteractionsProps> = ({
  isReply,
  isUser,
  message,
  contextMenu,
  setContextMenu,
  handleReplyMessage: replyMessage,
  handleDeleteMessage: deleteMessage,
  handleEditMessage,
  handleReactionMessage,
}) => {
  const { roomsList, activeRoomJID } = useRoomState();
  const [showPicker, setShowPicker] = useState(false);

  const config = useSelector(
    (state: RootState) => state.chatSettingStore.config
  );

  const closeMenu = () => {
    if (!config?.disableInteractions) {
      setContextMenu({ visible: false, x: 0, y: 0 });
    }
  };

  const closeContextMenu = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeMenu();
    }
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    closeMenu();
  };

  const handleReplyMessage = () => {
    replyMessage();
    closeMenu();
  };

  const handleDeleteMessage = () => {
    deleteMessage();
    closeMenu();
  };

  const handleEmojiSelect = (emoji, e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) {
      console.log('emoji', emoji);
      handleReactionMessage(emoji.id);
      closeMenu();
    }
  };

  const calculatePickerPosition = (x: number, y: number) => {
    const pickerWidth = 320;
    const pickerHeight = 435;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + pickerWidth > windowWidth) {
      adjustedX = windowWidth - pickerWidth - 10;
    }

    if (y + pickerHeight > windowHeight) {
      adjustedY = windowHeight - pickerHeight - 10;
    }

    return { adjustedX, adjustedY };
  };

  useEffect(() => {
    const handleScroll = () => {
      if (showPicker) {
        const { adjustedX, adjustedY } = calculatePickerPosition(
          contextMenu.x,
          contextMenu.y
        );
        setContextMenu({ visible: true, x: adjustedX, y: adjustedY });
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showPicker, contextMenu.x, contextMenu.y]);

  if (config?.disableInteractions || !contextMenu.visible) return null;

  return (
    <>
      {!message.isDeleted && (
        <Overlay onClick={closeContextMenu}>
          <ContainerInteractions
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <ReactionContainer>
              <ArrowButton
                isRotated={showPicker}
                onClick={(e) => {
                  e.stopPropagation();
                  const { adjustedX, adjustedY } = calculatePickerPosition(
                    contextMenu.x,
                    contextMenu.y
                  );
                  setContextMenu({
                    visible: true,
                    x: adjustedX,
                    y: adjustedY,
                  });
                  setShowPicker(!showPicker);
                }}
              >
                <DownArrowIcon />
              </ArrowButton>
            </ReactionContainer>
            <ContextMenu onClick={closeContextMenu}>
              {!isReply && (
                <>
                  <MenuItem onClick={handleReplyMessage}>
                    {MESSAGE_INTERACTIONS.REPLY}
                    <MESSAGE_INTERACTIONS_ICONS.REPLY />{' '}
                  </MenuItem>
                  <Delimeter />
                </>
              )}
              <MenuItem onClick={() => handleCopyMessage(message.body)}>
                {MESSAGE_INTERACTIONS.COPY}
                <MESSAGE_INTERACTIONS_ICONS.COPY />
              </MenuItem>
              <Delimeter />
              {isUser && (
                <>
                  <MenuItem onClick={handleEditMessage}>
                    {MESSAGE_INTERACTIONS.EDIT}
                    <MESSAGE_INTERACTIONS_ICONS.EDIT />{' '}
                  </MenuItem>
                  <Delimeter />
                </>
              )}
              {(isUser || roomsList?.[activeRoomJID].role === 'moderator') && (
                <MenuItem onClick={handleDeleteMessage}>
                  {MESSAGE_INTERACTIONS.DELETE}
                  <MESSAGE_INTERACTIONS_ICONS.DELETE />{' '}
                </MenuItem>
              )}
              {/* <Delimeter />
          <MenuItem onClick={() => console.log(MESSAGE_INTERACTIONS.REPORT)}>
            {MESSAGE_INTERACTIONS.REPORT}
            <MESSAGE_INTERACTIONS_ICONS.REPORT />{' '}
          </MenuItem> */}
            </ContextMenu>
          </ContainerInteractions>
        </Overlay>
      )}
    </>
  );
};

export default MessageInteractions;
