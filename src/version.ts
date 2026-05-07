// Build-time version constant for the AI Chat Widget bundle.
//
// Replaced at build time via vite's `define` (see vite.config.ts) — the
// value mirrors `package.json#version` so the runtime banner cannot drift
// from the published version. The fallback empty string only kicks in for
// non-vite consumers (unit tests, ts-node) and is intentionally distinct
// from any real version so the discrepancy is obvious if it ever appears.
//
// Renamed from the legacy ETHORA_CHAT_COMPONENT_VERSION: this widget is
// its own package (`@ethora/ai-chat-widget`), not chat-component. The old
// name was a fork-time copy artefact that produced a misleading
// `[EthoraChatComponent] version: ...` banner.

declare const __ETHORA_AI_CHAT_WIDGET_VERSION__: string;

export const ETHORA_AI_CHAT_WIDGET_VERSION: string =
  typeof __ETHORA_AI_CHAT_WIDGET_VERSION__ !== 'undefined'
    ? __ETHORA_AI_CHAT_WIDGET_VERSION__
    : '';

// Back-compat re-export for callers still importing the old name. Safe to
// remove once no consumer references it.
export const ETHORA_CHAT_COMPONENT_VERSION = ETHORA_AI_CHAT_WIDGET_VERSION;
