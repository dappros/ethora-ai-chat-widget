// Firebase Auth stub (Google sign-in is not used by the assistant widget;
// the widget authenticates anonymously over XMPP). See firebase-app.ts.
export const getAuth = () => null;
export class GoogleAuthProvider {
  static credential() {
    return null;
  }
}
export class OAuthProvider {}
export const signInWithPopup = async () => {
  throw new Error('[ethora-widget] firebase auth is disabled in this build');
};
export const signInWithCredential = async () => {
  throw new Error('[ethora-widget] firebase auth is disabled in this build');
};
export const User = undefined as any;
