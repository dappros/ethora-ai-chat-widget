// Stylesheet for the widget's own chrome: launcher, teaser, panel, header,
// empty state and status screens. It lives in the widget's Shadow DOM, under
// `.ew-root`, so nothing reaches the host page.
//
// The conversation itself (bubbles, composer, markdown) is NOT restyled here:
// it is chat-component's own look, so the widget and the web component read as
// one product. Only the quick-reply buttons get a skin (widget/quickReplies.ts)
// and the message entrance motion below.

/** Launcher / teaser / panel motion. Transform and opacity only. */
export const CHROME_KEYFRAMES = `
@keyframes ew-pulse-glow {
  0%, 100% { box-shadow: 0 0 0 4px var(--ew-glow-ring), 0 10px 22px -8px var(--ew-glow-soft); }
  50%      { box-shadow: 0 0 0 7px var(--ew-glow-ring), 0 10px 28px -6px var(--ew-glow-strong); }
}
/* The teaser's bounce moves the element only. Its opacity is static (see the
   teaser rule) so a stalled animation clock can never leave it invisible. */
@keyframes ew-fade-bounce {
  0%   { transform: translateY(-3px); }
  10%  { transform: translateY(-1px); }
  50%  { transform: translateY(1px); }
  90%  { transform: translateY(3px); }
  100% { transform: translateY(1px); }
}
@keyframes ew-panel-in {
  0%   { opacity: 0; transform: translateY(18px) scale(0.92); }
  60%  { opacity: 1; }
  100% { opacity: 1; transform: none; }
}
@keyframes ew-panel-out {
  from { opacity: 1; transform: none; }
  to   { opacity: 0; transform: translateY(12px) scale(0.95); }
}
@keyframes ew-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes ew-msg-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
@keyframes ew-chip-in {
  from { opacity: 0; transform: translateY(6px) scale(0.96); }
  to   { opacity: 1; transform: none; }
}
@keyframes ew-teaser-in {
  from { opacity: 0; transform: translateY(8px) scale(0.94); }
  to   { opacity: 1; transform: none; }
}
`;

export const CHROME_CSS = `
${CHROME_KEYFRAMES}

.ew-root {
  --ew-primary: #0052cd;
  --ew-glow-ring: color-mix(in srgb, var(--ew-primary) 16%, transparent);
  --ew-glow-soft: color-mix(in srgb, var(--ew-primary) 34%, transparent);
  --ew-glow-strong: color-mix(in srgb, var(--ew-primary) 58%, transparent);
  --ew-surface: #ffffff;
  --ew-text: #24292f;
  --ew-text-2: #57606a;
  --ew-hair: rgba(0, 0, 0, 0.08);
  --ew-hover: rgba(0, 0, 0, 0.06);
  --ew-ease: cubic-bezier(0.16, 1, 0.3, 1);
  color: var(--ew-text);
  -webkit-font-smoothing: antialiased;
}
.ew-root[data-ew-scheme="dark"] {
  --ew-surface: #161b22;
  --ew-text: #e6edf3;
  --ew-text-2: #9da7b3;
  --ew-hair: rgba(255, 255, 255, 0.1);
  --ew-hover: rgba(255, 255, 255, 0.08);
}

.ew-root button:focus-visible {
  outline: 2px solid var(--ew-primary);
  outline-offset: 2px;
}

/* ---- launcher ----------------------------------------------------------- */
.ew-launcher {
  border: none;
  padding: 0;
  cursor: pointer;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
  box-shadow: 0 0 12px var(--ew-glow-soft);
  transition: transform 320ms var(--ew-ease), box-shadow 240ms ease;
}
.ew-launcher:hover { transform: scale(1.09) rotate(-3deg); }
.ew-launcher:active { transform: scale(0.94); transition-duration: 90ms; }
.ew-launcher--glow { animation: ew-pulse-glow 2.8s ease-in-out infinite; }

/* Teaser above the closed launcher. A button, so the copy is clickable. */
.ew-teaser {
  position: absolute;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: calc(100vw - 64px);
  padding: 10px 14px;
  border: none;
  border-radius: 12px;
  background: #ffffff;
  color: #333;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font: inherit;
  font-size: 14px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  /* Opacity stays static (see the bounce keyframes): visibility must never
     depend on an animation clock that may be stalled. */
  opacity: 1;
  animation: ew-fade-bounce 5s ease forwards;
  transition: box-shadow 200ms ease;
}
.ew-teaser:hover { box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18); }
.ew-teaser-spark { display: none; }

/* ---- panel -------------------------------------------------------------- */
.ew-panel {
  position: relative;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--ew-surface);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  transform-origin: 100% 100%;
  animation: ew-panel-in 380ms var(--ew-ease) both;
}
.ew-dock-left .ew-panel { transform-origin: 0% 100%; }
.ew-panel.ew-closing { animation: ew-panel-out 180ms ease-in both; }
.ew-panel.ew-expanded { animation-name: ew-fade-in; animation-duration: 220ms; }

/* Small screens: the panel becomes a bottom sheet across the full width. */
@media (max-width: 520px) {
  .ew-panel:not(.ew-expanded) {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    bottom: 0 !important;
    width: 100% !important;
    height: min(88dvh, calc(100dvh - 16px)) !important;
    border-radius: 16px 16px 0 0 !important;
  }
}

/* Resize: only the corner that faces into the page. It carries a small
   corner mark so people can find it: it breathes twice when the panel opens,
   then rests faint, and brightens with a soft glow on hover and while dragging. */
.ew-edge {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 6;
  width: 34px;
  height: 34px;
  cursor: nwse-resize;
  touch-action: none;
  background: transparent;
  transition: background-color 200ms ease;
}
.ew-edge::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 26px;
  height: 26px;
  box-sizing: border-box;
  /* A bright arc laid exactly along the panel's rounded corner. */
  border-top: 3px solid #fff;
  border-left: 3px solid #fff;
  border-top-left-radius: 16px;
  opacity: 0.55;
  transition: opacity 200ms ease, width 260ms var(--ew-ease), height 260ms var(--ew-ease);
  animation: ew-grip-hint 1.6s ease-in-out 700ms 2;
}
.ew-edge--right { left: auto; right: 0; cursor: nesw-resize; }
.ew-edge--right::after {
  left: auto;
  right: 0;
  border-left: none;
  border-right: 3px solid #fff;
  border-top-left-radius: 0;
  border-top-right-radius: 16px;
}
.ew-edge:hover,
.ew-edge:active {
  background: radial-gradient(circle at 0 0, rgba(255, 255, 255, 0.45), transparent 72%);
}
.ew-edge--right:hover,
.ew-edge--right:active {
  background: radial-gradient(circle at 100% 0, rgba(255, 255, 255, 0.45), transparent 72%);
}
.ew-edge:hover::after,
.ew-edge:active::after { opacity: 1; animation: none; width: 34px; height: 34px; }
@keyframes ew-grip-hint {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}
@media (max-width: 520px) { .ew-edge { display: none; } }
@media (prefers-reduced-motion: reduce) { .ew-edge::after { animation: none; } }

.ew-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
  padding: 12px 14px;
  background: var(--ew-primary);
  color: #fff;
}
.ew-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.ew-avatar {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}
.ew-avatar img { width: 70%; height: 70%; object-fit: contain; }
.ew-online, .ew-subtitle { display: none; }
.ew-titles { display: flex; flex-direction: column; min-width: 0; }
.ew-title {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@container (max-width: 300px) {
  .ew-header .ew-iconbtn--expand { display: none; }
}

.ew-actions { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; }
.ew-iconbtn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #fff;
  cursor: pointer;
  transition: background-color 180ms ease, transform 260ms var(--ew-ease);
}
.ew-iconbtn:hover,
.ew-iconbtn[aria-expanded="true"] { background: rgba(255, 255, 255, 0.18); }
.ew-iconbtn:active { transform: scale(0.88); transition-duration: 80ms; }
.ew-iconbtn svg { transition: transform 300ms var(--ew-ease); }
.ew-iconbtn:hover svg { transform: scale(1.12); }

.ew-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  min-width: 160px;
  padding: 5px;
  border-radius: 12px;
  background: var(--ew-surface);
  border: 1px solid var(--ew-hair);
  box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  z-index: 2;
  transform-origin: 100% 0;
  animation: ew-chip-in 220ms var(--ew-ease) both;
}
.ew-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 11px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ew-text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background-color 140ms ease;
}
.ew-menu-item:hover { background: var(--ew-hover); }
.ew-menu-item[aria-selected="true"] { color: var(--ew-primary); font-weight: 600; }

.ew-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

/* Messages ease in instead of popping. Only the entrance is animated, never
   layout, so scroll anchoring is untouched. */
.ew-root [data-ethora-bubble] { animation: ew-msg-in 340ms var(--ew-ease) both; }

/* A little more air between message bubbles (+2px on every gap). The wrapper
   attribute is written by attachQuickReplyLayout. */
.ew-root div[data-ew-side] { padding-top: 2px; }

/* Tighter message text. The markdown renderer sets a 1.6 line-height and a 12px
   margin on every paragraph inline, which made short replies tall; inline
   styles only lose to !important. */
.ew-root .message-body,
.ew-root .message-body > div { font-size: 14px !important; line-height: 1.45 !important; }
.ew-root .message-body p,
.ew-root .message-body ul,
.ew-root .message-body ol,
.ew-root .message-body pre,
.ew-root .message-body blockquote {
  margin: 0 0 6px !important;
  line-height: 1.45 !important;
}
.ew-root .message-body p:last-child,
.ew-root .message-body > div > :last-child { margin-bottom: 0 !important; }
.ew-root .message-body p:first-child { margin-top: 0 !important; }

/* Status screens (connecting, offline) shown inside the body. */
.ew-status {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  color: var(--ew-text-2);
  font-size: 13px;
}
.ew-status-title { font-size: 15px; font-weight: 600; color: var(--ew-text); }

/* Empty state: mirrors the engine's own placeholder layout. */
.ew-empty {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 20px;
  text-align: center;
}
.ew-empty-orb { color: var(--ew-primary); }
.ew-empty-title { font-size: 16px; font-weight: 600; }
.ew-empty-body { max-width: 260px; font-size: 14px; line-height: 1.5; color: var(--ew-text-2); }

/* The composer's emoji picker is not offered in the assistant. */
.ew-root div:has(> div > textarea) > button[aria-expanded] { display: none !important; }

@media (prefers-reduced-motion: reduce) {
  .ew-launcher, .ew-launcher:hover, .ew-launcher:active,
  .ew-teaser, .ew-panel, .ew-panel.ew-closing, .ew-menu,
  .ew-iconbtn, .ew-iconbtn svg, .ew-root [data-ethora-bubble] {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
`;
