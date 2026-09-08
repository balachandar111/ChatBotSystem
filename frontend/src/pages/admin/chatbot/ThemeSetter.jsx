import { useEffect, useState } from "react";
import api from "../../../api/axios.js";
import { ensureGoogleFont, FONT_FAMILY_OPTIONS } from "../../../lib/googleFont.js";

/*
|--------------------------------------------------------------------------
| ThemeSetter
|--------------------------------------------------------------------------
| Tab inside the Chatbot Builder where the Admin fully re-skins their
| public widget: logo, header title/subtitle, navbar color, chat area
| color OR a background image, and an accent color used for buttons/
| bubbles. Everything is optional — leaving a field blank means the
| widget falls back to its built-in default (see widget.css / BotWidget.jsx).
|
| Saves via PUT /chatbots/:id/theme. Logo and background image both go
| through POST /chatbots/upload-theme-asset (Cloudinary), same pattern as
| the product-card image upload in the Flow Builder tab.
*/

const DEFAULTS = {
  navBgColor: "#3b3486",
  navTextColor: "#ffffff",
  accentColor: "#3b3486",
  chatBgColor: "#f7f8fc",
};

function blankTheme() {
  return {
    logoUrl: "",
    title: "",
    subtitle: "",
    navBgColor: "",
    navTextColor: "",
    accentColor: "",
    fontFamily: "",
    chatBgType: "color",
    chatBgColor: "",
    chatBgImageUrl: "",
    bgVideoEnabled: false,
    bgVideoUrl: "",
  };
}

const MAX_BG_VIDEO_MB = 25;

export default function ThemeSetter({ chatbot, onSaved }) {
  const [theme, setTheme] = useState(() => ({ ...blankTheme(), ...(chatbot.theme || {}) }));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [uploading, setUploading] = useState(null); // "logo" | "bg" | "video" | null

  const set = (patch) => setTheme((prev) => ({ ...prev, ...patch }));

  // Load the chosen Google Font into this admin page too, so the live
  // preview on the right actually renders in it instead of silently
  // falling back to whatever generic font the browser already has under
  // that name.
  useEffect(() => {
    if (theme.fontFamily) ensureGoogleFont(theme.fontFamily);
  }, [theme.fontFamily]);

  const upload = async (file, field) => {
    setUploading(field === "logoUrl" ? "logo" : "bg");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await api.post("/chatbots/upload-theme-asset", form);
      set({ [field]: res.data.data.url });
    } catch (err) {
      alert(err.response?.data?.message || "Image upload failed");
    } finally {
      setUploading(null);
    }
  };

  const uploadVideo = async (file) => {
    if (file.size > MAX_BG_VIDEO_MB * 1024 * 1024) {
      alert(`Video is too large. Max size is ${MAX_BG_VIDEO_MB}MB.`);
      return;
    }
    setUploading("video");
    try {
      const form = new FormData();
      form.append("video", file);
      const res = await api.post("/chatbots/upload-theme-video", form);
      set({ bgVideoUrl: res.data.data.url, bgVideoEnabled: true });
    } catch (err) {
      alert(err.response?.data?.message || "Video upload failed");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await api.put(`/chatbots/${chatbot._id}/theme`, { theme });
      onSaved?.(res.data.data);
      setSaveMsg("Theme saved.");
    } catch (err) {
      setSaveMsg(err.response?.data?.message || "Could not save theme");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 4000);
    }
  };

  const resetToDefault = () => setTheme(blankTheme());

  // Values actually used for the live preview (theme choice, else built-in default)
  const previewNavBg = theme.navBgColor || DEFAULTS.navBgColor;
  const previewNavText = theme.navTextColor || DEFAULTS.navTextColor;
  const previewAccent = theme.accentColor || DEFAULTS.accentColor;
  const previewChatBg = theme.chatBgType === "image" && theme.chatBgImageUrl
    ? undefined
    : theme.chatBgColor || DEFAULTS.chatBgColor;
  const previewChatBgImage = theme.chatBgType === "image" && theme.chatBgImageUrl ? theme.chatBgImageUrl : null;
  const previewTitle = theme.title || chatbot.name;
  const previewSubtitle = theme.subtitle || (chatbot.mode === "voice" ? "AI Voice Assistant" : "Chat Assistant");
  const previewFontFamily = theme.fontFamily ? `"${theme.fontFamily}", sans-serif` : undefined;

  return (
    <div className="field-row" style={{ alignItems: "flex-start", gap: 24 }}>
      {/* ---------------- Controls ---------------- */}
      <div style={{ flex: "1 1 420px", minWidth: 320 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4 }}>Branding</h3>
          <p className="helper-text" style={{ marginBottom: 14 }}>
            Shown in the widget header and as the bot's avatar. Leave blank to use the chatbot's name.
          </p>

          <div className="field">
            <label>Logo</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {theme.logoUrl ? (
                <img
                  src={theme.logoUrl}
                  alt="Logo preview"
                  width={48}
                  height={48}
                  style={{ borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)" }}
                />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border)",
                  }}
                />
              )}
              <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
                {uploading === "logo" ? "Uploading…" : theme.logoUrl ? "Change logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "logoUrl")}
                />
              </label>
              {theme.logoUrl && (
                <button className="btn btn-ghost btn-sm" onClick={() => set({ logoUrl: "" })}>
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Header title</label>
              <input
                type="text"
                placeholder={chatbot.name}
                value={theme.title}
                onChange={(e) => set({ title: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Header subtitle</label>
              <input
                type="text"
                placeholder={chatbot.mode === "voice" ? "AI Voice Assistant" : "Chat Assistant"}
                value={theme.subtitle}
                onChange={(e) => set({ subtitle: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4 }}>Colors</h3>
          <p className="helper-text" style={{ marginBottom: 14 }}>
            Navbar is the header bar; accent tints buttons, option chips, and the customer's chat bubbles.
          </p>

          <div className="field-row">
            <div className="field">
              <label>Navbar background</label>
              <ColorField value={theme.navBgColor} fallback={DEFAULTS.navBgColor} onChange={(v) => set({ navBgColor: v })} />
            </div>
            <div className="field">
              <label>Navbar text</label>
              <ColorField value={theme.navTextColor} fallback={DEFAULTS.navTextColor} onChange={(v) => set({ navTextColor: v })} />
            </div>
            <div className="field">
              <label>Accent color</label>
              <ColorField value={theme.accentColor} fallback={DEFAULTS.accentColor} onChange={(v) => set({ accentColor: v })} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4 }}>Typography</h3>
          <p className="helper-text" style={{ marginBottom: 14 }}>
            Sets the font used everywhere in the widget — header, messages, and quick-reply chips.
          </p>

          <div className="field" style={{ maxWidth: 260 }}>
            <label>Font family</label>
            <select
              value={theme.fontFamily || ""}
              onChange={(e) => set({ fontFamily: e.target.value })}
            >
              {FONT_FAMILY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4 }}>Chat area background</h3>
          <p className="helper-text" style={{ marginBottom: 14 }}>
            Pick a flat color, or set a background image the chat scrolls over.
          </p>

          <div className="tabs" style={{ borderBottom: "none", marginBottom: 14 }}>
            <button
              className={"tab-btn" + (theme.chatBgType !== "image" ? " active" : "")}
              onClick={() => set({ chatBgType: "color" })}
              style={{ marginRight: 12 }}
            >
              Solid color
            </button>
            <button
              className={"tab-btn" + (theme.chatBgType === "image" ? " active" : "")}
              onClick={() => set({ chatBgType: "image" })}
            >
              Background image
            </button>
          </div>

          {theme.chatBgType === "image" ? (
            <div className="field" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {theme.chatBgImageUrl && (
                  <img
                    src={theme.chatBgImageUrl}
                    alt="Chat background preview"
                    width={64}
                    height={44}
                    style={{ borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)" }}
                  />
                )}
                <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
                  {uploading === "bg" ? "Uploading…" : theme.chatBgImageUrl ? "Change image" : "Upload image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "chatBgImageUrl")}
                  />
                </label>
                {theme.chatBgImageUrl && (
                  <button className="btn btn-ghost btn-sm" onClick={() => set({ chatBgImageUrl: "" })}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="field" style={{ marginBottom: 0, maxWidth: 220 }}>
              <ColorField value={theme.chatBgColor} fallback={DEFAULTS.chatBgColor} onChange={(v) => set({ chatBgColor: v })} />
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4 }}>Background video</h3>
          <p className="helper-text" style={{ marginBottom: 14 }}>
            An ambient, muted, looping video played behind the whole chat window — purely decorative, never intercepts taps.
            Leave off to use the chat area background above instead.
          </p>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={theme.bgVideoEnabled}
              disabled={!theme.bgVideoUrl}
              onChange={(e) => set({ bgVideoEnabled: e.target.checked })}
            />
            Enable background video
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {theme.bgVideoUrl ? (
              <video
                src={theme.bgVideoUrl}
                muted
                loop
                autoPlay
                playsInline
                width={96}
                height={64}
                style={{ borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)" }}
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 64,
                  borderRadius: 8,
                  background: "var(--surface-sunken)",
                  border: "1px dashed var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "#94a3b8",
                }}
              >
                No video
              </div>
            )}
            <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
              {uploading === "video" ? "Uploading…" : theme.bgVideoUrl ? "Change video" : "Upload video"}
              <input
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])}
              />
            </label>
            {theme.bgVideoUrl && (
              <button className="btn btn-ghost btn-sm" onClick={() => set({ bgVideoUrl: "", bgVideoEnabled: false })}>
                Remove
              </button>
            )}
          </div>
          <p className="helper-text" style={{ marginTop: 10 }}>
            MP4, WebM, OGG or MOV, up to {MAX_BG_VIDEO_MB}MB.
          </p>
        </div>

        {saveMsg && <p className="helper-text" style={{ marginBottom: 12 }}>{saveMsg}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Theme"}
          </button>
          <button className="btn btn-outline" onClick={resetToDefault}>
            Reset to default
          </button>
        </div>
      </div>

      {/* ---------------- Live preview ---------------- */}
      <div style={{ flex: "0 0 300px" }}>
        <p className="helper-text" style={{ marginBottom: 8 }}>Live preview</p>
        <div
          style={{
            position: "relative",
            width: 300,
            height: 460,
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 14px 34px rgba(23,26,43,0.16)",
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--border)",
            fontFamily: previewFontFamily,
          }}
        >
          {theme.bgVideoEnabled && theme.bgVideoUrl && (
            <>
              <video
                src={theme.bgVideoUrl}
                muted
                loop
                autoPlay
                playsInline
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
              />
              <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.72)", zIndex: 0 }} />
            </>
          )}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              background: previewNavBg,
              color: previewNavText,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {theme.logoUrl ? (
              <img
                src={theme.logoUrl}
                alt="Logo"
                width={34}
                height={34}
                style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.4)" }}
              />
            ) : (
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)",
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {previewTitle}
              </div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{previewSubtitle}</div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: previewChatBg,
              backgroundImage: previewChatBgImage ? `url(${previewChatBgImage})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "80%",
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: "14px 14px 14px 4px",
                padding: "8px 12px",
                fontSize: 12.5,
              }}
            >
              Hi! How can we help you today?
            </div>
            <div
              style={{
                alignSelf: "flex-end",
                maxWidth: "80%",
                background: previewAccent,
                color: "#fff",
                borderRadius: "14px 14px 4px 14px",
                padding: "8px 12px",
                fontSize: 12.5,
              }}
            >
              I have a question
            </div>
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  border: `1px solid ${previewAccent}55`,
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 12,
                  color: previewAccent,
                  fontWeight: 600,
                }}
              >
                A · Track my order
              </div>
              <div
                style={{
                  background: "#fff",
                  border: `1px solid ${previewAccent}55`,
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 12,
                  color: previewAccent,
                  fontWeight: 600,
                }}
              >
                B · Talk to support
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ value, fallback, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="color"
        value={value || fallback}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 34, padding: 2, border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
      />
      <input
        type="text"
        value={value}
        placeholder={fallback}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1 }}
      />
    </div>
  );
}