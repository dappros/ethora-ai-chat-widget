// AI Widget MUC variant: provision a visitor + room by calling the install's
// `POST /v2/widget/sessions` endpoint. Replaces the legacy client-side
// `anon-<uuid>` credential flow that talked 1:1 to the bot JID — visitor
// JIDs are now app-prefixed (`${appId}_widget-<uuid>`) so mod_ethora's
// per-app guard accepts them as MUC room members, and conversations live
// in persistent MUC rooms that the platform admin can review later.
//
// The visitor's JID + password are persisted to localStorage so a returning
// visitor on the same browser keeps their identity (and their conversation
// history is reachable to operators by visitor _id). Cookies vs localStorage:
// cookies would be sent on every backend call, but the widget only ever uses
// these creds for the SASL bind to ejabberd — keeping them in localStorage
// avoids exposing the password as a default-attached credential to other
// origins.

const VISITOR_STORAGE_KEY = 'ethora-widget-visitor';

export interface WidgetVisitor {
  xmppUsername: string;
  xmppPassword: string;
  uuid: string;
  // Fully-qualified bare JID, e.g. `${appId}_widget-<uuid>@xmpp.example.com`.
  // Convenience for clients that want a complete bind target without having
  // to know the host; falls back to `xmppUsername` when the host is empty.
  jid?: string;
}

export interface WidgetRoom {
  name: string;
  chatId: string;
  // Fully-qualified MUC room JID, e.g. `${appId}_<roomUuid>@conference.example.com`.
  jid?: string;
}

export interface WidgetBot {
  xmppUsername: string;
  jid?: string;
  // Persona fields surfaced from the active Agent (when one is bound
  // via App.defaultBotInstanceId on the server). Empty strings when
  // the install is on the legacy aiBot path; bundle then falls back
  // to platform-default copy ("AI Assistant" etc.).
  displayName?: string;
  avatarUrl?: string;
  greetingMessage?: string;
}

export interface WidgetSessionXmpp {
  host: string;
  service: string;
  // Canonical websocket URL, e.g. `wss://xmpp.example.com/ws`. Server
  // surfaces it so the widget client doesn't have to guess at the port
  // (`:5443/ws` works on dev-style installs but production deploys
  // terminate WSS at nginx on standard 443).
  wsUrl?: string;
}

export interface WidgetSessionEnvelope {
  visitor: WidgetVisitor;
  room: WidgetRoom;
  bot: WidgetBot;
  xmpp?: WidgetSessionXmpp;
}

interface ProvisionWidgetSessionInput {
  appId: string;
  // Base URL of the install's API, e.g. "https://api.example.com". Used to
  // POST to `${apiBase}/v2/widget/sessions`.
  apiBase: string;
  // Optional: when set, used as the resume key. Defaults to whatever's in
  // localStorage. Pass `null` to explicitly bypass any persisted visitor.
  resumeXmppUsername?: string | null;
}

interface PersistedVisitorRecord {
  appId: string;
  xmppUsername: string;
  xmppPassword: string;
  uuid: string;
}

function readPersistedVisitor(appId: string): PersistedVisitorRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedVisitorRecord;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.appId === appId &&
      typeof parsed.xmppUsername === 'string' &&
      typeof parsed.xmppPassword === 'string' &&
      typeof parsed.uuid === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writePersistedVisitor(record: PersistedVisitorRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage may be disabled (incognito with strict settings, etc.).
    // Non-fatal: the session still works for this page load, just won't
    // resume on the next one.
  }
}

function clearPersistedVisitor(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(VISITOR_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  // Strip any trailing /vN (or /vN/) so the caller's apiBase can be
  // either a clean host (`https://api.example.com`) or one already
  // suffixed with the legacy v1 prefix (`https://api.example.com/v1`,
  // which is the conventional VITE_API value in Ethora frontends).
  // Without this strip, a `data-api-base="https://api.example.com/v1"`
  // on the embed `<script>` produces the wrong URL when joined with
  // `/v2/widget/sessions` — `https://api.example.com/v1/v2/widget/sessions`
  // — which 404s.
  const cleanBase = base.replace(/\/v\d+\/?$/, '');
  const trimmedBase = cleanBase.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

export async function provisionWidgetSession(
  input: ProvisionWidgetSessionInput
): Promise<WidgetSessionEnvelope> {
  const { appId, apiBase } = input;
  if (!appId) {
    throw new Error('provisionWidgetSession: appId is required');
  }
  if (!apiBase) {
    throw new Error('provisionWidgetSession: apiBase is required');
  }

  // Resolve resume hint. Caller-supplied takes precedence; otherwise consult
  // localStorage. Explicit null bypasses the persisted record entirely.
  let resumeXmppUsername: string | undefined;
  if (input.resumeXmppUsername === null) {
    resumeXmppUsername = undefined;
  } else if (typeof input.resumeXmppUsername === 'string') {
    resumeXmppUsername = input.resumeXmppUsername;
  } else {
    const persisted = readPersistedVisitor(appId);
    if (persisted) {
      resumeXmppUsername = persisted.xmppUsername;
    }
  }

  const url = joinUrl(apiBase, '/v2/widget/sessions');
  const body: Record<string, string> = { appId };
  if (resumeXmppUsername) body.resumeXmppUsername = resumeXmppUsername;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // 404 / 409 / 422 — the embed UI shows a generic "couldn't connect"
    // state, but we surface the code on the thrown error so consumers can
    // distinguish "AI not configured here" from a transient outage.
    let detail: any = null;
    try {
      detail = await response.json();
    } catch {
      // ignore — fall back to status-only error
    }
    // If the persisted JID is what triggered the error (server rejected our
    // resume), wipe it so the next attempt mints a fresh visitor instead of
    // looping on a dead identity.
    if (resumeXmppUsername && response.status === 422) {
      clearPersistedVisitor();
    }
    const err: any = new Error(
      `Widget session provisioning failed (HTTP ${response.status})`
    );
    err.status = response.status;
    err.code = detail?.code;
    err.detail = detail;
    throw err;
  }

  const envelope = (await response.json()) as WidgetSessionEnvelope;
  if (
    !envelope ||
    !envelope.visitor ||
    !envelope.visitor.xmppUsername ||
    !envelope.room ||
    !envelope.room.name ||
    !envelope.bot ||
    !envelope.bot.xmppUsername
  ) {
    throw new Error('Widget session provisioning returned malformed envelope');
  }

  // Persist for next visit. Includes the password — it's a randomly-generated
  // ejabberd credential scoped to a single anonymous visitor, no harm in
  // localStorage on the embedding origin.
  writePersistedVisitor({
    appId,
    xmppUsername: envelope.visitor.xmppUsername,
    xmppPassword: envelope.visitor.xmppPassword,
    uuid: envelope.visitor.uuid,
  });

  return envelope;
}

// Exported for tests + consumers that want to forcibly re-anonymise (e.g. a
// "Start new conversation" button in a future revision).
export const __widgetSessionStorage = {
  read: readPersistedVisitor,
  write: writePersistedVisitor,
  clear: clearPersistedVisitor,
  KEY: VISITOR_STORAGE_KEY,
};
