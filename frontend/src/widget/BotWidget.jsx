import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import NormalEngine from "./NormalEngine.jsx";
import VoiceEngine from "./VoiceEngine.jsx";
import { BotBadgeIcon, SoundOnIcon, SoundOffIcon } from "./Icons.jsx";
import { ensureGoogleFont } from "../lib/googleFont.js";
import "./widget.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function getSessionId() {
  let id = sessionStorage.getItem("cbw_session_id");
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem("cbw_session_id", id);
  }
  return id;
}

/**
 * Turns the Admin's saved theme (see backend/models/Chatbot.js -> themeSchema)
 * into CSS custom properties for the widget shell. Any field the Admin left
 * blank is simply omitted here, so widget.css's own `var(--x, fallback)`
 * defaults take over -- every un-themed bot still looks exactly like before.
 */
function themeToCssVars(theme) {
  if (!theme) return {};
  const vars = {};
  if (theme.navBgColor) vars["--cbw-nav-bg"] = theme.navBgColor;
  if (theme.navTextColor) vars["--cbw-nav-text"] = theme.navTextColor;
  if (theme.accentColor) vars["--cbw-accent"] = theme.accentColor;
  if (theme.fontFamily) vars["--cbw-font"] = `"${theme.fontFamily}", sans-serif`;
  if (theme.chatBgType === "image" && theme.chatBgImageUrl) {
    vars["--cbw-chat-bg-image"] = `url("${theme.chatBgImageUrl}")`;
  } else if (theme.chatBgColor) {
    vars["--cbw-chat-bg"] = theme.chatBgColor;
  }
  return vars;
}

/**
 * Purely decorative, looping, muted background video shown behind the
 * whole widget shell when the Admin enables it in the Theme Setter
 * (theme.bgVideoEnabled + theme.bgVideoUrl). pointer-events: none so it
 * never intercepts taps/clicks; a translucent white overlay keeps it from
 * fighting the chat content for attention (see .widget-bg-video-* in
 * widget.css, and the "has-bg-video" modifier that makes the header/body/
 * options/etc. panels transparent so the video actually shows through).
 */
function BackgroundVideo({ src }) {
  return (
    <div className="widget-bg-video-wrap" aria-hidden="true">
      <video className="widget-bg-video" src={src} autoPlay muted loop playsInline preload="auto" tabIndex={-1} />
      <div className="widget-bg-video-overlay" />
    </div>
  );
}

/**
 * `subdomain` is passed in only when this widget is being mounted directly
 * at "/" because the visitor is on a chatbot's own vanity subdomain (e.g.
 * https://muthuwinss.geninuety.com — see main.jsx's hostname detection).
 * Otherwise (normal /bot/:slug route) it's undefined and we fall back to
 * the route param exactly like before.
 */
export default function BotWidget({ subdomain } = {}) {
  const { slug: routeSlug } = useParams();
  const [searchParams] = useSearchParams();
  const [bot, setBot] = useState(null);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState(null);
  // AI Voice Chatbot mute toggle. Lives here (not inside VoiceEngine) so
  // the button can render in the header next to the language toggle
  // instead of floating on top of it. Irrelevant for non-voice bots.
  const [voiceOn, setVoiceOn] = useState(true);
  const sessionId = getSessionId();

  // Set by widget-loader.js's embed iframe (see backend/public/widget-loader.js)
  // so the widget fills the panel edge-to-edge instead of rendering the
  // page's own centered/padded layout.
  const isEmbedded = searchParams.get("embed") === "1";

  useEffect(() => {
    const url = subdomain
      ? `${API_BASE}/public/bots/subdomain/${subdomain}`
      : `${API_BASE}/public/bots/${routeSlug}`;

    axios
      .get(url)
      .then((res) => {
        setBot(res.data.data);
        setLanguage(res.data.data.languages?.[0] || "english");
      })
      .catch((err) => setError(err.response?.data?.message || "This chatbot is not available"));
  }, [subdomain, routeSlug]);

  // Always the bot's real slug, regardless of whether it was loaded via the
  // /bot/:slug route or a vanity subdomain — this is what query/TTS
  // submission actually needs (see sanitizeBot in publicBotController.js,
  // which now always includes `slug` in the response for this reason).
  const slug = bot?.slug || routeSlug;

  const theme = bot?.theme || {};
  const headerTitle = theme.title || bot?.name || "Chatbot";
  const headerSubtitle = theme.subtitle || (bot?.mode === "voice" ? "AI Voice Assistant" : "Chat Assistant");

  // Loads the admin's chosen Google Font (see ThemeSetter.jsx's
  // "Typography" card) so customers actually see it, not a silent
  // fallback to the browser's default sans-serif.
  useEffect(() => {
    if (theme.fontFamily) ensureGoogleFont(theme.fontFamily);
  }, [theme.fontFamily]);

  // "fullscreen" -> edge-to-edge standalone page (matches the reference
  // full-screen chatbot design). "widget" bots normally live inside the
  // widget-loader.js iframe panel (isEmbedded), which is already sized by
  // the host page, so it also renders edge-to-edge with no extra chrome.
  const isFullBleed = bot?.displayMode === "fullscreen" || isEmbedded;
  const hasBgVideo = Boolean(theme.bgVideoEnabled && theme.bgVideoUrl);

  return (
    <div className={`widget-page ${isFullBleed ? "widget-page-fullscreen" : ""}`}>
      <div
        className={`widget-shell ${isFullBleed ? "widget-shell-fullscreen" : ""} ${hasBgVideo ? "widget-shell-has-video" : ""}`}
        style={{ position: "relative", ...themeToCssVars(theme) }}
      >
        {hasBgVideo && <BackgroundVideo src={theme.bgVideoUrl} />}

        <div className="widget-header">
          <div className="widget-header-brand">
            <span className="widget-header-badge">
              {theme.logoUrl ? (
                <img src={theme.logoUrl} alt={headerTitle} className="widget-logo-img" />
              ) : (
                <BotBadgeIcon className="widget-badge-icon" />
              )}
            </span>
            <div>
              <h2>{headerTitle}</h2>
              <div className="tag">{headerSubtitle}</div>
            </div>
          </div>
          {(bot?.languages?.length > 1 || bot?.mode === "voice") && (
            <div className="widget-header-actions">
              {bot.languages?.length > 1 && (
                <div className="widget-lang-toggle">
                  {bot.languages.map((l) => (
                    <button key={l} className={language === l ? "active" : ""} onClick={() => setLanguage(l)}>
                      {l === "tamil" ? "தமிழ்" : "EN"}
                    </button>
                  ))}
                </div>
              )}

              {bot.mode === "voice" && (
                <button
                  type="button"
                  className="voice-toggle"
                  onClick={() => setVoiceOn((v) => !v)}
                  title={voiceOn ? "Turn sound off" : "Turn sound on"}
                  aria-label={voiceOn ? "Turn sound off" : "Turn sound on"}
                  aria-pressed={!voiceOn}
                >
                  {voiceOn ? (
                    <SoundOnIcon className="voice-toggle-icon" />
                  ) : (
                    <SoundOffIcon className="voice-toggle-icon" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="widget-centered">
            <p>{error}</p>
          </div>
        )}

        {!error && !bot && <div className="widget-centered">Loading chatbot…</div>}

        {!error && bot && language && bot.mode === "voice" && (
          <VoiceEngine bot={bot} language={language} sessionId={sessionId} slug={slug} theme={theme} voiceOn={voiceOn} />
        )}

        {!error && bot && language && bot.mode !== "voice" && (
          <NormalEngine bot={bot} language={language} sessionId={sessionId} slug={slug} theme={theme} />
        )}
      </div>
    </div>
  );
}