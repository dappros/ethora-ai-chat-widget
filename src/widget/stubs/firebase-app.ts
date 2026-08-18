// Firebase stub. The assistant widget never uses push notifications or
// Google sign-in, and chat-component guards every firebase call behind a
// config check (firebase-config.ts returns null when no VITE_FIREBASE_* env
// is present, which is our case). So firebase is never actually invoked at
// runtime - stubbing these modules keeps the named imports resolvable while
// dropping the (very large) firebase SDK from the bundle.
export const initializeApp = () => ({ name: 'stub', options: {} });
export const getApps = () => [] as any[];
export const getApp = () => null;
export const deleteApp = () => {};
export const FirebaseApp = undefined as any;
