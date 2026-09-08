import { useEffect, useRef, useState } from "react";
import { useChatFlow } from "./useChatFlow.js";
import ProductGrid from "./ProductGrid.jsx";
import DynamicForm from "./DynamicForm.jsx";
import StepsCard from "./StepsCard.jsx";
import { BotBadgeIcon } from "./Icons.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// BCP-47 tag the browser's SpeechSynthesis voice list is matched against.
const BROWSER_LANG = { tamil: "ta-IN", english: "en-US" };

/**
 * Picks a browser TTS voice for `lang` (e.g. "ta-IN"), preferring an exact
 * match and falling back to the same base language (e.g. any "ta-*").
 * Returns null if the device genuinely has no voice for it at all — most
 * desktop browsers don't ship a Tamil voice out of the box, so this is
 * expected on many machines (Android devices with Google's TTS engine
 * installed are the most reliable place to test Tamil).
 */
function pickVoice(voices, lang) {
  if (!voices?.length) return null;
  const base = lang.split("-")[0];
  return (
    voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(base)) ||
    null
  );
}

/**
 * AI Voice Chatbot engine. Every bot message is read aloud, preferring a
 * real AWS Polly voice (backend/controllers/ttsController.js) and falling
 * back to the browser's own SpeechSynthesis API when Polly can't help —
 * which, today, is every Tamil message: Amazon Polly does not currently
 * offer a Tamil voice at all (see backend/config/polly.js), so Tamil
 * always uses the browser voice, while English gets the AWS Polly voice
 * when AWS credentials are configured on the backend.
 *
 * `voiceOn` is owned by BotWidget.jsx and rendered as a speaker icon in the
 * widget header (next to the language toggle) — a customer who doesn't
 * want the bot talking can tap it to mute; this engine just stops speaking
 * (and cancels anything mid-playback) whenever it flips to false.
 *
 * Also renders Admin-configured "products" grids and dynamic "form" nodes,
 * same as the normal engine. `theme` is used for the bot's avatar; it also
 * glows gently while the bot is speaking (see .widget-avatar-speaking in
 * widget.css), and the header/avatar shows a typing pulse in the brief
 * pause between the user's action and the bot's reply appearing.
 */
export default function VoiceEngine({ bot, language, sessionId, slug, theme, voiceOn }) {
  const { currentNode, messages, path, finished, endedByForm, isTyping, brokenLink, choose, advance } = useChatFlow(
    bot,
    language
  );
  const [speaking, setSpeaking] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState(""); // e.g. "no Tamil voice on this device"
  const lastSpokenIndex = useRef(-1);
  const audioRef = useRef(null);
  const bodyEndRef = useRef(null);
  // Most browsers load their voice list asynchronously; getVoices() often
  // returns [] on the very first call, right when the greeting message
  // wants to speak. Without this, the first (or only) Tamil utterance
  // silently used the browser's default voice/language instead of Tamil,
  // reading the Tamil text with the wrong phonetics or not at all —
  // easy to mistake for "Tamil voice isn't working".
  const [browserVoices, setBrowserVoices] = useState(() => window.speechSynthesis?.getVoices?.() || []);

  const nodeType = currentNode?.nodeType || "message";

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setBrowserVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => {
    if (!voiceOn) return;

    const lastBotIndex = [...messages].map((m) => m.sender).lastIndexOf("bot");
    if (lastBotIndex === -1 || lastBotIndex === lastSpokenIndex.current) return;

    lastSpokenIndex.current = lastBotIndex;
    const text = messages[lastBotIndex].text;
    if (!text) return;

    let cancelled = false;
    setVoiceNotice("");

    const speakWithBrowser = () => {
      if (cancelled || !("speechSynthesis" in window)) return;
      const lang = BROWSER_LANG[language] || "en-US";
      const voice = pickVoice(browserVoices, lang);
      if (!voice && language === "tamil") {
        // No Tamil voice installed on this device at all — speaking
        // anyway would come out as English-accented gibberish, which
        // reads as "broken" rather than just "no voice available".
        // Show the text-only bubble (already rendered below) and say so.
        setVoiceNotice("No Tamil voice found on this device — showing text only.");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      utterance.pitch = 1.05;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    };

    // Try a real AWS Polly voice first (backend/controllers/ttsController.js).
    // It replies 422 { unsupported: true } for Tamil (Polly has no Tamil
    // voice) or if AWS isn't configured — either way we just fall back.
    fetch(`${API_BASE}/public/bots/${slug}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return speakWithBrowser();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioRef.current?.pause();
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setSpeaking(true);
        audio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setSpeaking(false);
          speakWithBrowser();
        };
        audio.play().catch(() => speakWithBrowser());
      })
      .catch(() => {
        if (!cancelled) speakWithBrowser();
      });

    return () => {
      cancelled = true;
    };
  }, [messages, voiceOn, language, slug, browserVoices]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
    };
  }, []);

  // The mute button now lives in the widget header (see BotWidget.jsx),
  // so it can sit cleanly next to the language toggle instead of floating
  // on top of it. Whichever component owns the click just flips `voiceOn`;
  // this stops whatever is currently playing/queued the instant it does.
  useEffect(() => {
    if (voiceOn) return;
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    setSpeaking(false);
  }, [voiceOn]);

  // Keep the newest message (or the typing indicator) in view.
  useEffect(() => {
    bodyEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isTyping, nodeType]);

  const BotAvatar = ({ isSpeaking }) => (
    <span className={`widget-avatar${isSpeaking ? " widget-avatar-speaking" : ""}`}>
      {theme?.logoUrl ? (
        <img src={theme.logoUrl} alt="" className="widget-avatar-img" />
      ) : (
        <BotBadgeIcon className="widget-avatar-icon" />
      )}
    </span>
  );

  return (
    <div className="widget-body">
      {messages.map((m, i) => (
        <div key={i} className={`widget-msg-row widget-msg-row-${m.sender}`}>
          {m.sender === "bot" && <BotAvatar isSpeaking={speaking && i === messages.length - 1} />}
          <div className={`bubble bubble-${m.sender}`}>{m.text}</div>
        </div>
      ))}

      {isTyping && (
        <div className="widget-msg-row widget-msg-row-bot">
          <BotAvatar />
          <div className="bubble bubble-bot widget-typing">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}

      {!isTyping && !finished && nodeType === "message" && currentNode && !currentNode.isEnd && (
        <div className="widget-options">
          {currentNode.options.map((opt, i) => (
            <button key={i} className="option-btn" onClick={() => choose(opt)}>
              <span className="opt-label">{opt.label}</span>
              <span>{opt.text}</span>
            </button>
          ))}
        </div>
      )}

      {!isTyping && !finished && nodeType === "products" && currentNode && (
        <ProductGrid node={currentNode} onContinue={(next) => advance(next)} />
      )}

      {!isTyping && !finished && nodeType === "steps" && currentNode && (
        <StepsCard node={currentNode} onDone={(next) => advance(next)} />
      )}

      {!isTyping && !finished && nodeType === "form" && currentNode && (
        <DynamicForm
          node={currentNode}
          slug={slug}
          sessionId={sessionId}
          language={language}
          path={path}
          onSubmitted={(nextKey, summary) => advance(nextKey, { summaryText: summary, viaForm: true })}
        />
      )}

      {!isTyping && finished && brokenLink && (
        <p className="widget-thanks">
          This part of the chat isn't available right now — please try again shortly, or contact us directly.
        </p>
      )}

      {!isTyping && finished && !brokenLink && endedByForm && (
        <p className="widget-thanks">Thanks — we've received your details.</p>
      )}

      {voiceNotice && <p className="widget-voice-notice">{voiceNotice}</p>}

      <div ref={bodyEndRef} />
    </div>
  );
}