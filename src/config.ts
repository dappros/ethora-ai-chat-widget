// Default Ethora Cloud (production) endpoints.
// The API base URL can be overridden at runtime via the `data-api-url`
// attribute on the embed <script id="chat-content-assistant"> tag
// (see src/main.tsx), so self-hosted / dedicated deployments can point the
// widget at their own server without rebuilding.
export const VITE_APP_API_URL = 'https://api.chat.ethora.com/v1';
export const VITE_APP_DISABLE_STRICT = 'true';
export const VITE_APP_DOMAIN_NAME = 'ethora.com';
export const VITE_APP_XMPP_BASEDOMAIN_OLD = 'xmpp.chat.ethora.com';
export const VITE_APP_XMPP_BASEDOMAIN = 'xmpp.chat.ethora.com';

export const SERVICE = `wss://${VITE_APP_XMPP_BASEDOMAIN}/ws`;
