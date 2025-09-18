import React, { FC } from 'react';
import {
  LastRoomMessageContainer,
  LastRoomMessageName,
  LastRoomMessageText,
} from './StyledRoomComponents';
import { LastMessage } from '../../../types/types';

interface LastMessageEmojiProps extends Pick<LastMessage, 'user' | 'emoji'> {}

const LastMessageEmoji: FC<LastMessageEmojiProps> = ({ user, emoji }) => {
  return (
    <LastRoomMessageContainer>
      <LastRoomMessageName>{user.name || ''}:</LastRoomMessageName>
    </LastRoomMessageContainer>
  );
};

export default LastMessageEmoji;
