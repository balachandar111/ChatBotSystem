// Small, generic line icons for the chat widget theme — no brand-specific
// artwork, so they suit any Admin's bot. Colored via `currentColor` so a
// parent's `color` sets the tint.

export function BotBadgeIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="5" y="8" width="14" height="11" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9.5" cy="13.5" r="1.3" fill="currentColor" />
      <circle cx="14.5" cy="13.5" r="1.3" fill="currentColor" />
      <path d="M12 8V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="3.6" r="1.4" fill="currentColor" />
      <path d="M8 19v1.4M16 19v1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Subtle scattered watermark motif behind the chat (dot-in-leaf shape,
// generic enough for any brand's palette).
export function GrainIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 1.5c4.5 3 7 7.2 7 11.2 0 4.2-3.1 9.8-7 9.8s-7-5.6-7-9.8c0-4 2.5-8.2 7-11.2Z"
        fill="currentColor"
      />
      <path d="M12 2.5c0 6-.4 12-1.6 19" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
  );
}

// Placeholder shown on a product card when the Admin hasn't uploaded an image yet.
export function ImagePlaceholderIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8.2" cy="9.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 16.5l5-4.5 3.2 3 3.3-4L21 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Placeholder shown on a step card (nodeType: "steps") when the Admin
// hasn't uploaded a photo for that step yet — a generic numbered-checklist
// glyph, brand-neutral so it suits any Admin's bot.
export function StepPlaceholderIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="8.5" r="0.9" fill="currentColor" />
      <circle cx="7" cy="12" r="0.9" fill="currentColor" />
      <circle cx="7" cy="15.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

// Speaker-with-sound-waves icon — shown on the AI Voice Chatbot's mute
// button while voice replies are ON (tap to turn sound off).
export function SoundOnIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 9.5v5h3.6L13 18.7V5.3L7.6 9.5H4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M16.2 8.8a5 5 0 0 1 0 6.4M18.6 6.4a8.4 8.4 0 0 1 0 11.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Speaker-with-slash icon — shown on the AI Voice Chatbot's mute button
// while voice replies are OFF (tap to turn sound back on). A customer who
// doesn't want the bot reading messages aloud taps this to silence it.
export function SoundOffIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 9.5v5h3.6L13 18.7V5.3L7.6 9.5H4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}