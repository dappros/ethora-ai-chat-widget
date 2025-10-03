// Removed imports for deleted modal components

export const MODAL_TYPES = {
  SETTINGS: 'settings',
  PROFILE: 'profile',
  CHAT_PROFILE: 'chatprofile',

  // SETTINGS: 'Settings',
  // PROFILE: 'Profile',
  // CHAT_PROFILE: 'Chat Profile',

  // MANAGE_DATA: 'Manage Data',
  // VISIBILITY: 'Visiblility',
  // PROFILE_SHARES: 'Profile Shares',
  // DOCUMENT_SHARES: 'Document Shares',
  // BLOCKED_USERS: 'Blocked Users',
  // REFERRALS: 'Referrals',
};

export const MODAL_COMPONENTS: Record<
  string,
  React.FC<{ handleCloseModal: () => void }>
> = {};
