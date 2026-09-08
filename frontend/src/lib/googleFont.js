// Injects (once per font, ever) a <link> that loads a Google Font's
// stylesheet. Used by both:
//   - ThemeSetter.jsx, so the "Typography" card's live preview actually
//     renders in the chosen font, not just whatever the browser already
//     happens to have installed for that family name.
//   - BotWidget.jsx, so the *public* widget renders in the admin's chosen
//     font too (see themeToCssVars() -> --cbw-font).
// Picking a font that isn't loaded anywhere just silently falls back to
// the nearest system font with the same name (or the browser's default
// serif/sans-serif) with zero visible error, so this has to be called
// wherever the font is applied, not just in one place.
const loadedFonts = new Set();

export function ensureGoogleFont(fontFamily) {
  if (!fontFamily || typeof document === "undefined") return;
  if (loadedFonts.has(fontFamily)) return;
  loadedFonts.add(fontFamily);

  const familyParam = fontFamily.trim().replace(/\s+/g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

// Kept in one place so the admin's dropdown (ThemeSetter.jsx) and any
// future font-related UI stay in sync automatically.
export const FONT_FAMILY_OPTIONS = [
  { value: "", label: "Default (Inter)" },
  { value: "Poppins", label: "Poppins" },
  { value: "Jost", label: "Jost" },
  { value: "Nunito", label: "Nunito" },
  { value: "Quicksand", label: "Quicksand" },
  { value: "Roboto", label: "Roboto" },
  { value: "Work Sans", label: "Work Sans" },
];