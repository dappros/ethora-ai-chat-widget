import { FC, useCallback } from 'react';
import { useXmppClient } from '../context/xmppProvider';
import { useDispatch, useSelector } from 'react-redux';
import { uploadFile } from '../networking/api-requests/auth.api';
import { RootState } from '../roomStore';
import { useChatSettingState } from './useChatSettingState';
import { v4 as uuidv4 } from 'uuid';
import { AsisstantUserType } from '../types/types';
import { addRoomMessage } from '../roomStore/assistantMessageSlice';

export const useSendMessage = () => {
  const { config } = useChatSettingState();
  const { client } = useXmppClient();
  const dispatch = useDispatch();

  const { user } = useSelector((state: RootState) => ({
    user: state.chatSettingStore.user,
  }));

  const sendMessage = useCallback(
    (
      message: string,
      activeRoomJID: string,
      user: AsisstantUserType,
      mainMessage?: string
    ) => {
      const id = `send-text-message-${Date.now().toString()}`;

      dispatch(
        addRoomMessage({
          roomJID: activeRoomJID,
          message: {
            id: id,
            user,
            date: new Date().toISOString(),
            body: message,
            roomJid: activeRoomJID,
            pending: true,
            xmppFrom: `${activeRoomJID}/${user.xmppUsername}`,
          },
        })
      );

      client?.sendMessage(activeRoomJID, message, mainMessage || '', id);
    },
    []
  );

  const sendMedia = useCallback(
    async (
      data: File,
      type: string,
      activeRoomJID: string,
      isReply = false,
      isChecked = false,
      mainMessage = ''
    ) => {
      const id = `send-media-message:${uuidv4()}`;
      if (!config?.disableSentLogic) {
        dispatch(
          addRoomMessage({
            roomJID: activeRoomJID,
            message: {
              id: id,
              body: 'media',
              roomJid: activeRoomJID,
              date: new Date().toISOString(),
              user: {
                ...user,
                id: user.xmppUsername,
                name: user.firstName + ' ' + user.lastName,
              },
              pending: true,
              isDeleted: false,
              xmppId: id,
              xmppFrom: `${activeRoomJID}/${user.xmppUsername}`,
              isSystemMessage: 'false',
              isMediafile: 'true',
              fileName: data.name,
              location: '',
              locationPreview: '',
              mimetype: type,
              originalName: data.name,
              size: data.size.toString(),
              isReply,
              showInChannel: `${isChecked}`,
              mainMessage,
              timestamp: Date.now(),
            },
          })
        );
      }

      const mediaData = new FormData();
      mediaData.append('files', data);

      try {
        const response = await uploadFile(mediaData);

        for (const item of response.data.results) {
          const messagePayload = {
            firstName: user.firstName,
            lastName: user.lastName,
            walletAddress: user.walletAddress,
            createdAt: item.createdAt,
            expiresAt: item.expiresAt,
            fileName: item.filename,
            isVisible: item?.isVisible,
            location: item.location,
            locationPreview: item.locationPreview,
            mimetype: item.mimetype,
            originalName: item?.originalname,
            ownerKey: item?.ownerKey,
            size: item.size,
            duration: item?.duration,
            updatedAt: item?.updatedAt,
            userId: item?.userId,
            attachmentId: item?._id,
            wrappable: true,
            roomJid: activeRoomJID,
            showInChannel: isChecked,
            isReply,
            mainMessage,
            isPrivate: item?.isPrivate,
            __v: item.__v,
          };

          client?.sendMediaMessageStanza(activeRoomJID, messagePayload, id);
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    },
    [client, config, user]
  );

  return {
    sendMessage,
    sendMedia,
  };
};
