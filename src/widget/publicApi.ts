// The widget's public surface on `window`.
//
// Hosts previously had to reach into the widget's localStorage by hand to
// reset it - the admin app hardcoded one key name and missed the other
// eleven, so its "Reset" button did not reset. That is a leaking
// abstraction: the widget owns its storage schema and changes it (it has
// grown from a handful of keys to twelve), and every host that copied the
// list breaks silently on the next change.
//
// So the widget exposes the operations instead of the schema.

import { WIDGET_ATTRIBUTES, type AttributeSpec } from './attributes';
import { __widgetSessionStorage } from '../utils/provisionWidgetSession';

export interface EthoraAssistantApi {
  /** Remove the UI but keep the visitor identity and cached transcript. */
  destroy(): void;
  /**
   * Remove the UI and erase everything this widget owns, so the next mount
   * behaves like a first-ever visit: new visitor, new room, empty history.
   */
  reset(): void;
  /** Whether the widget is currently mounted. */
  isMounted(): boolean;
  /** The `data-*` contract this build actually reads. */
  attributes: readonly AttributeSpec[];
  version: string;
}

declare global {
  interface Window {
    EthoraAssistant?: EthoraAssistantApi;
  }
}

/**
 * Every localStorage key the widget owns. Kept here, next to the code that
 * clears it, so there is exactly one list. `assistantChatOpen` is a legacy
 * name from the pre-new-arch widget: still cleared, never written.
 */
export const OWNED_STORAGE_KEYS = [
  'ethora-widget-visitor',
  'ethora-widget-app-id',
  'EthoraAssistantOpen',
  'EthoraAssistantExpanded',
  'EthoraAssistantCtaDismissed',
  'assistantChatOpen',
  'persist:root',
  'persist:chatSettingStore',
  'persist:roomMessages',
  'persist:rooms',
  'persist:assistanRoomSlice',
  'persist:roomHeapSlice',
  '@ethora/chat-component-cache-scope',
  '@ethora/chat-component-user-session',
] as const;

export function clearOwnedStorage(): void {
  OWNED_STORAGE_KEYS.forEach((k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      // storage disabled; nothing to clear
    }
  });
  try {
    __widgetSessionStorage.clear();
  } catch {
    // ignore
  }
}

/** Set by the bootstrap so `destroy` can tear the tree down properly. */
let teardown: (() => void) | null = null;

export function registerTeardown(fn: () => void): void {
  teardown = fn;
}

function unmount(): void {
  try {
    teardown?.();
  } catch {
    // a failed React unmount must not block storage cleanup
  }
  teardown = null;
  document.getElementById('chat-widget')?.remove();
}

export function installPublicApi(version: string): void {
  const api: EthoraAssistantApi = {
    destroy: unmount,
    reset() {
      unmount();
      clearOwnedStorage();
    },
    isMounted: () => !!document.getElementById('chat-widget'),
    attributes: WIDGET_ATTRIBUTES,
    version,
  };
  try {
    window.EthoraAssistant = api;
  } catch {
    // sandboxed window; the widget still works, hosts just cannot drive it
  }
}
