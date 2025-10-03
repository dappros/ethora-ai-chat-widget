import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { IRoom } from '../../types/types';
import { SearchInput } from '../InputComponents/Search';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../roomStore';
import { SearchIcon } from '../../assets/icons';
// Removed DropdownMenu
import { logout, setActiveModal } from '../../roomStore/chatSettingsSlice';
// Removed NewChatModal
import { setLogoutState } from '../../roomStore/roomsSlice';
import {
  BurgerButton,
  Container,
  Divider,
  ScollableContainer,
  SearchContainer,
} from '../styled/RoomListComponents';
import { MODAL_TYPES } from '../../helpers/constants/MODAL_TYPES';
import { useXmppClient } from '../../context/xmppProvider';
// Removed ChatRoomItem
import { useChatSettingState } from '../../hooks/useChatSettingState';

interface RoomListProps {
  chats: IRoom[];
  burgerMenu?: boolean;
  onRoomClick?: (chat: IRoom) => void;
  isSmallScreen?: boolean;
}

const RoomList: React.FC<RoomListProps> = ({
  chats,
  burgerMenu = false,
  onRoomClick,
  isSmallScreen,
}) => {
  const { client, setClient } = useXmppClient();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const dispatch = useDispatch();

  const { config } = useChatSettingState();

  const { activeRoomJID } = useSelector((state: RootState) => state.rooms);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(event.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  const performClick = useCallback(
    (chat: IRoom) => {
      if (chat.jid === activeRoomJID && !isSmallScreen) {
        return;
      }

      onRoomClick?.(chat);
      setOpen(false);
    },
    [onRoomClick]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    },
    []
  );

  const getLastMessageId = useCallback((chat: IRoom) => {
    const rawId = chat?.messages?.[chat?.messages.length - 1]?.id ?? '';
    const numericId = rawId.replace(/\D+/g, '');
    const paddedId = numericId.padEnd(16, '0');
    return paddedId;
  }, []);

  const filteredChats = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const chatsMap = new Map<string, IRoom[]>();

    if (!chatsMap.has(lowerCaseSearchTerm)) {
      const result = chats
        .filter((chat) =>
          chat.name?.toLowerCase().includes(lowerCaseSearchTerm)
        )
        .sort((a, b) => {
          const aLastId = getLastMessageId(a)
            ? Number(getLastMessageId(a))
            : null;
          const bLastId = getLastMessageId(b)
            ? Number(getLastMessageId(b))
            : null;
          const aCreated = a.createdAt
            ? new Date(a.createdAt).getTime() * 1000
            : null;
          const bCreated = b.createdAt
            ? new Date(b.createdAt).getTime() * 1000
            : null;

          const aCompare = aLastId !== null ? aLastId : aCreated;
          const bCompare = bLastId !== null ? bLastId : bCreated;

          if (aCompare === null && bCompare === null) return 0;
          if (aCompare === null) return 1;
          if (bCompare === null) return -1;

          return bCompare - aCompare;
        });

      chatsMap.set(lowerCaseSearchTerm, result);
    }

    return chatsMap.get(lowerCaseSearchTerm) || [];
  }, [chats, searchTerm]);

  useEffect(() => {
    if (burgerMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [burgerMenu, handleClickOutside]);

  const isChatActive = useCallback(
    (room: IRoom) => !isSmallScreen && activeRoomJID === room.jid,
    [activeRoomJID]
  );

  const handleLogout = useCallback(async () => {
    if (client) {
      await client.close();
      setClient(null);
    }
    dispatch(setLogoutState());
    dispatch(logout());
  }, []);

  const menuOptions = useMemo(
    () => [
      {
        label: 'Profile',
        icon: null,
        onClick: () => {
          dispatch(setActiveModal(MODAL_TYPES.PROFILE));
          console.log('Profile clicked');
        },
      },
      {
        label: 'Settings',
        icon: null,
        onClick: () => {
          dispatch(setActiveModal(MODAL_TYPES.SETTINGS));
          console.log('Settings clicked');
        },
      },
      {
        label: 'Logout',
        icon: null,
        onClick: () => handleLogout(),
      },
    ],
    []
  );

  return (
    <>
      {burgerMenu && !open && (
        <BurgerButton onClick={() => setOpen(!open)}>☰</BurgerButton>
      )}
      <Container
        burgerMenu={burgerMenu}
        open={open}
        ref={containerRef}
        style={{
          ...config?.roomListStyles,
          ...(isSmallScreen ? { width: '100%' } : { maxWidth: '432px' }),
          flex: isSmallScreen ? 1 : '0 1 432px',
        }}
      >
        {(open || !burgerMenu) && (
          <ScollableContainer>
            <SearchContainer>
              {/* Room menu removed */}
              <SearchInput
                icon={<SearchIcon height={'20px'} />}
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search..."
                // animated={true}
              />

              {/* NewChatModal removed */}
            </SearchContainer>
            <div
              style={{ flexGrow: 1, overflowY: 'auto', padding: '16px 0px' }}
            >
              {filteredChats.map((chat: IRoom, index: number) => (
                <React.Fragment key={`${chat.id}-${index}`}>
                  <div
                    onClick={() => performClick(chat)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: isChatActive(chat)
                        ? '#F5F5F5'
                        : 'transparent',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>
                        {chat.title || chat.name}
                      </span>
                      {chat.lastMessage && (
                        <span style={{ color: '#8C8C8C', fontSize: 12 }}>
                          {chat.lastMessage?.body?.slice(0, 40)}
                        </span>
                      )}
                    </div>
                    {chat.unreadMessages ? (
                      <span
                        style={{
                          minWidth: 20,
                          height: 20,
                          borderRadius: 10,
                          background: '#0052CD',
                          color: 'white',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          padding: '0px 6px',
                        }}
                      >
                        {chat.unreadMessages}
                      </span>
                    ) : null}
                  </div>
                  {index < filteredChats.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </div>
          </ScollableContainer>
        )}
      </Container>
    </>
  );
};

export default RoomList;
