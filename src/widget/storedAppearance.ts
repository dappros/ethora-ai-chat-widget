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

export async function fetchStoredAppearance({ appId, apiBase }: { appId: string; apiBase: string }): Promise<StoredAppearance> {
  if (!appId || !apiBase || typeof fetch !== 'function') return {};
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
  try {
    const url = `${joinUrl(apiBase, '/v2/widget/config')}?appId=${encodeURIComponent(appId)}`;
    const resp = await fetch(url, { signal: controller?.signal, credentials: 'omit' });
    if (!resp.ok) return {};
    const body = await resp.json();
    const raw = body && typeof body.appearance === 'object' && body.appearance ? body.appearance : {};
    const out: StoredAppearance = {};
    for (const [attr, value] of Object.entries(raw)) {
      if (!attr.startsWith('data-') || IDENTITY_ATTRIBUTES.has(attr)) continue;
      if (typeof value === 'string') out[attr] = value;
    }
    return out;
  } catch {
    return {};
  } finally {
    if (timer) clearTimeout(timer);
  }
}
