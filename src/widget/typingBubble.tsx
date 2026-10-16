import React from 'react';

// Typing indicator, handed to chat-component through
// `config.customTypingIndicator.customComponent`. A soft pill in the bot's
// colours: three dots that rise and fall in a smooth wave, each one swelling a
// touch as it peaks, and a quiet label that breathes beside them. Keyframes
// live in this component's own <style>, so they sit in the Shadow DOM with the
// widget. Motion stops for prefers-reduced-motion.

const ACCENT = 'var(--ew-primary, #0052CD)';

const CSS = `
@keyframes ew-typing-wave {
  0%, 60%, 100% { transform: translateY(0) scale(0.82); opacity: 0.38; }
  30%           { transform: translateY(-5px) scale(1.08); opacity: 1; }
}
@keyframes ew-typing-breathe {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}
@keyframes ew-typing-in {
  from { opacity: 0; transform: translateY(6px) scale(0.96); }
  to   { opacity: 1; transform: none; }
}
.ew-typing {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 6px 0 4px 8px;
  padding: 8px 14px 8px 12px;
  border-radius: 16px;
  border-bottom-left-radius: 5px;
  background: #fff;
  border: 1px solid color-mix(in srgb, ${ACCENT} 14%, #e6e8ec);
  box-shadow: 0 2px 8px -4px rgba(15, 23, 42, 0.18);
  animation: ew-typing-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.ew-typing-dots { display: inline-flex; align-items: center; gap: 4px; height: 14px; }
.ew-typing-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: linear-gradient(135deg, color-mix(in srgb, ${ACCENT} 70%, #fff), ${ACCENT});
  animation: ew-typing-wave 1.25s cubic-bezier(0.45, 0, 0.35, 1) infinite;
}
.ew-typing-dot:nth-child(2) { animation-delay: 0.16s; }
.ew-typing-dot:nth-child(3) { animation-delay: 0.32s; }
.ew-typing-label {
  font-size: 12px;
  color: #6b7686;
  animation: ew-typing-breathe 2.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .ew-typing, .ew-typing-dot, .ew-typing-label { animation: none; }
  .ew-typing-dot { opacity: 0.7; }
}
`;

export const WidgetTypingBubble: React.FC<{
  usersTyping: string[];
  text: string;
  isVisible: boolean;
}> = ({ text, isVisible }) => {
  if (!isVisible) return null;
  return (
    <div className="ew-typing" role="status" aria-live="polite">
      <style>{CSS}</style>
      <span className="ew-typing-dots" aria-hidden="true">
        <span className="ew-typing-dot" />
        <span className="ew-typing-dot" />
        <span className="ew-typing-dot" />
      </span>
      {text ? <span className="ew-typing-label">{text}</span> : null}
    </div>
  );
};
