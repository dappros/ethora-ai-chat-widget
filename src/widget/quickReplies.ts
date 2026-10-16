// Look of the bot's quick-reply buttons.
//
// chat-component renders them (QuickReplies.tsx) as a
// `<div role="group" aria-label="Quick replies">` of buttons, with
// styled-components rules we cannot edit from here. This module restyles that
// group from OUTSIDE, inside the widget's Shadow DOM, so nothing leaks to the
// host page. Every selector is scoped to the group. Colours come from the
// `--ew-*` palette on the widget root (see widget/chromeCss.ts).
//
// Two looks, chosen with data-button-style:
//   pill (default) - outlined, softly tinted buttons that fill on hover
//   list           - one bordered row per option with a trailing chevron
//
// Specificity: the component's rules are one class (or class + :hover). The
// selectors below are attribute-based, so they win without !important.

const GROUP = '[role="group"][aria-label="Quick replies"]';
const CHIP = `${GROUP} > button`;
const ACCENT = 'var(--ew-primary, var(--ethora-qr-accent, #0052CD))';

/** A label longer than this (in characters) counts as "long". */
const LONG_LABEL_CHARS = 18;
/** At this many long labels the pill group stacks full width instead of wrapping. */
const STACK_AT_LONG_LABELS = 3;

export type QuickReplyStyle = 'list' | 'pill';

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M9 6l6 6-6 6' fill='none' stroke='%23000' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

// The engine truncates a label with an ellipsis inside an inner span. Every
// look lets long labels wrap instead, so nothing is cut off.
const LABEL_WRAP = `
${CHIP} > span {
  display: block;
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: clip !important;
  max-width: none !important;
}
${CHIP} {
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: clip !important;
  height: auto !important;
}
`;

/**
 * "list": one neat, equal-width row per option, each a small bordered card with
 * a brand-coloured chevron. Reads like a menu of next steps.
 */
const LIST_CSS = `
${LABEL_WRAP}
${GROUP} {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 6px;
  margin: 10px 0 0;
  width: 100%;
  max-width: 100%;
}

${CHIP} {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 40px;
  margin: 0;
  padding: 9px 12px 9px 14px;
  border: 1px solid color-mix(in srgb, ${ACCENT} 16%, #dfe4ee);
  border-radius: 10px;
  background-color: color-mix(in srgb, ${ACCENT} 4%, #fff);
  color: color-mix(in srgb, ${ACCENT} 30%, #0c1a45);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.35;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: ew-chip-in 360ms var(--ew-ease, ease) both;
  transition: border-color 180ms ease, background-color 180ms ease, transform 200ms var(--ew-ease, ease), box-shadow 200ms ease;
}
${CHIP}:nth-child(2) { animation-delay: 50ms; }
${CHIP}:nth-child(3) { animation-delay: 100ms; }
${CHIP}:nth-child(4) { animation-delay: 150ms; }
${CHIP}:nth-child(n+5) { animation-delay: 200ms; }

${CHIP}::after {
  content: '';
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  background-color: ${ACCENT};
  opacity: 0.7;
  -webkit-mask: ${CHEVRON} center / contain no-repeat;
  mask: ${CHEVRON} center / contain no-repeat;
  transition: transform 220ms var(--ew-ease, ease), opacity 160ms ease;
}

${CHIP}:hover {
  border-color: ${ACCENT};
  background-color: color-mix(in srgb, ${ACCENT} 9%, #fff);
  box-shadow: 0 4px 12px -8px color-mix(in srgb, ${ACCENT} 60%, transparent);
}
${CHIP}:hover::after { transform: translateX(3px); opacity: 1; }
${CHIP}:active { transform: scale(0.985); transition-duration: 80ms; }

${CHIP}:focus-visible {
  outline: 2px solid ${ACCENT};
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  ${CHIP}, ${CHIP}::after { animation: none; transition: none; }
  ${CHIP}:hover::after, ${CHIP}:active { transform: none; }
}
`;

/**
 * "pill" (default): outlined, softly tinted buttons that fill with the brand
 * colour on hover, wrapping in rows.
 */
const PILL_CSS = `
${LABEL_WRAP}
${GROUP} {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 6px;
  margin-top: 8px;
  max-width: 100%;
}

${CHIP} {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  max-width: 100%;
  margin: 0;
  padding: 5px 12px;
  border: 1px solid color-mix(in srgb, ${ACCENT} 40%, transparent);
  border-radius: 12px;
  background-color: color-mix(in srgb, ${ACCENT} 6%, #fff);
  color: color-mix(in srgb, ${ACCENT} 86%, #000);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
  overflow-wrap: anywhere;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: ew-chip-in 340ms var(--ew-ease, ease) both;
  transition: background-color 0.18s ease, border-color 0.18s ease,
    color 0.18s ease, box-shadow 0.18s ease, transform 0.2s var(--ew-ease, ease);
}
${CHIP}:nth-child(2) { animation-delay: 40ms; }
${CHIP}:nth-child(3) { animation-delay: 80ms; }
${CHIP}:nth-child(4) { animation-delay: 120ms; }
${CHIP}:nth-child(n+5) { animation-delay: 160ms; }

${CHIP}:hover {
  background-color: ${ACCENT};
  border-color: ${ACCENT};
  color: #fff;
  box-shadow: 0 2px 8px color-mix(in srgb, ${ACCENT} 28%, transparent);
}

${CHIP}:active {
  transform: scale(0.97);
  background-color: color-mix(in srgb, ${ACCENT} 82%, #000);
  border-color: color-mix(in srgb, ${ACCENT} 82%, #000);
  color: #fff;
  box-shadow: none;
}

${CHIP}:focus-visible {
  outline: 2px solid ${ACCENT};
  outline-offset: 2px;
}

/* Three or more long labels read badly side by side: stack them full width. */
${GROUP}[data-stack] {
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
}

${GROUP}[data-stack] > button {
  justify-content: flex-start;
  text-align: left;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  ${CHIP} { animation: none; transition: none; }
  ${CHIP}:active { transform: none; }
}
`;

/**
 * Stylesheet for the chosen quick-reply look. Rendered inside the widget root,
 * so it reaches only the bot's quick-reply groups. "list" gets the list look;
 * anything else (including unset) gets pill.
 */
export function quickRepliesCss(style: QuickReplyStyle): string {
  if (style === 'list') return LIST_CSS;
  return PILL_CSS;
}

/**
 * Work out where each bot or visitor message sits in its run, and write it on
 * the message wrapper so the stylesheet can use plain attribute selectors:
 *   data-ew-side  "bot" | "user"
 *   data-ew-prev  "same" | "other" | "none"   (previous message, same side?)
 *   data-ew-next  "same" | "other" | "none"   (next message, same side?)
 * The engine wraps every message as wrapper > row > bubble, and the row's
 * first child is the avatar for bot messages.
 */
function sideOf(el: Element | null): 'bot' | 'user' | null {
  if (!el) return null;
  const bubble = el.querySelector('[data-ethora-bubble]');
  if (!bubble || !bubble.parentElement) return null;
  return bubble.parentElement.firstElementChild === bubble ? 'user' : 'bot';
}

function syncRuns(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-ethora-bubble]').forEach((bubble) => {
    const row = bubble.parentElement;
    const wrapper = row && row.parentElement;
    if (!row || !wrapper) return;
    const side = row.firstElementChild === bubble ? 'user' : 'bot';
    const relation = (other: Element | null) => {
      const s = sideOf(other);
      return s === null ? 'none' : s === side ? 'same' : 'other';
    };
    wrapper.setAttribute('data-ew-side', side);
    wrapper.setAttribute('data-ew-prev', relation(wrapper.previousElementSibling));
    wrapper.setAttribute('data-ew-next', relation(wrapper.nextElementSibling));
  });
}

/**
 * Mark pill groups that should stack full width. Runs on a MutationObserver
 * over the widget root because the chat mounts lazily and new bot messages
 * arrive over XMPP. It only watches childList, and it writes an attribute, so
 * it cannot retrigger itself. Only the pill look reads the attribute.
 *
 * Returns a disposer.
 */
export function attachQuickReplyLayout(root: HTMLElement): () => void {
  const sync = () => {
    syncRuns(root);
    root.querySelectorAll<HTMLElement>(GROUP).forEach((group) => {
      const longLabels = Array.from(group.querySelectorAll('button')).filter(
        (button) => (button.textContent || '').trim().length > LONG_LABEL_CHARS
      ).length;
      if (longLabels >= STACK_AT_LONG_LABELS) {
        group.setAttribute('data-stack', '');
      } else {
        group.removeAttribute('data-stack');
      }
    });
  };

  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true });
  sync();
  return () => observer.disconnect();
}
