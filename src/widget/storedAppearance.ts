// Appearance stored for this App in the admin's AI Widget tab
// (GET /v2/widget/config). Saved settings sit beneath the page's own
// configuration: a URL param or a data-* attribute on the embed still wins,
// so an existing snippet behaves exactly as before and a developer can pin a
// value on one page.
//
// Read once, before the launcher is drawn, with a short timeout: a slow or
// failing request only means the widget starts with the snippet's settings,
// it never holds up or breaks the page.
import { joinUrl } from '../utils/provisionWidgetSession';

const TIMEOUT_MS = 1500;

// Only appearance attributes are taken from the server; identity
// (data-app-id, data-api-base, data-bot-id) always comes from the page.
const IDENTITY_ATTRIBUTES = new Set(['data-app-id', 'data-api-base', 'data-api-url', 'data-bot-id']);

export type StoredAppearance = Record<string, string>;

const CACHE_KEY = 'ethora-widget-appearance';

export function readCachedAppearance(appId: string, apiBase: string): StoredAppearance {
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    return cached?.appId === appId && cached?.apiBase === apiBase && cached.appearance && typeof cached.appearance === 'object' && !Array.isArray(cached.appearance) ? cached.appearance : {};
  } catch { return {}; }
}

export function cacheAppearance(appId: string, apiBase: string, appearance: StoredAppearance): void {
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ appId, apiBase, appearance })); } catch { /* storage unavailable */ }
}

export async function fetchStoredAppearance({ appId, apiBase }: { appId: string; apiBase: string }): Promise<StoredAppearance | null> {
  if (!appId || !apiBase || typeof fetch !== 'function') return null;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
  try {
    const url = `${joinUrl(apiBase, '/v2/widget/config')}?appId=${encodeURIComponent(appId)}`;
    const resp = await fetch(url, { signal: controller?.signal, credentials: 'omit' });
    if (!resp.ok) return null;
    const body = await resp.json();
    const raw = body && typeof body.appearance === 'object' && body.appearance ? body.appearance : {};
    const out: StoredAppearance = {};
    for (const [attr, value] of Object.entries(raw)) {
      if (!attr.startsWith('data-') || IDENTITY_ATTRIBUTES.has(attr)) continue;
      if (typeof value === 'string') out[attr] = value;
    }
    return out;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
