const { SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const { pollyClient, LANGUAGE_VOICE_MAP } = require("../config/polly");
const { synthesizeWithGoogleTranslate } = require("../services/googleTranslateTts");
const Chatbot = require("../models/Chatbot");

// Polly caps a single request around 3000 billed characters for
// real-time synthesis; a chatbot message should never get near that, but
// guard it anyway instead of letting Polly reject it with a 400.
const MAX_CHARS = 3000;

// Google Translate TTS language code per internal language key. Tamil has
// no Polly voice at all (see config/polly.js), so it always goes through
// Google. English ALSO has a Google fallback ("en") — see below for why.
const GOOGLE_LANG_CODE = { tamil: "ta", english: "en" };

/*
|--------------------------------------------------------------------------
| POST /api/public/bots/:slug/tts
|--------------------------------------------------------------------------
| body: { text, language }
|
| Used by VoiceEngine.jsx (the "voice"-mode chatbot) to read each bot
| message aloud with a real voice instead of (or in addition to) the
| browser's own SpeechSynthesis. Streams back audio/mpeg on success.
|
| Tamil: Amazon Polly has no Tamil voice at all, so it always goes through
| Google Translate's free TTS endpoint (services/googleTranslateTts.js).
|
| English: tries AWS Polly first (better voice quality). If Polly isn't
| configured (no AWS credentials in .env) OR the Polly call itself fails
| for any reason, it now falls back to the same Google Translate endpoint
| (as "en") instead of returning a hard 422 — previously a missing/bad AWS
| setup meant English had NO server-side voice at all and always fell back
| to the browser's SpeechSynthesis. This keeps voice mode fully working
| the moment AWS is misconfigured, still switching to the (better-quality)
| Polly voice automatically once real credentials are added.
|
| Still responds 422 { unsupported: true } — not an error the widget
| should show the user — only if EVERY available provider for this
| language fails (e.g. the server's network can't reach Google at all),
| so the frontend can silently fall back to the browser voice as a last
| resort.
*/
exports.synthesizeSpeech = async (req, res) => {
  try {
    const { text, language } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "text is required" });
    }

    // Only serve TTS for a slug that belongs to a real, published voice
    // bot — keeps this endpoint from being used as a free-standing,
    // unauthenticated text-to-speech proxy for arbitrary text.
    const chatbot = await Chatbot.findOne({ slug: req.params.slug, status: "published" });
    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    const trimmedText = text.slice(0, MAX_CHARS);
    const pollyVoice = LANGUAGE_VOICE_MAP[language];
    const googleLangCode = GOOGLE_LANG_CODE[language];

    // 1) Try Polly first, but only for a language it actually has a voice
    // for (currently just English) and only if AWS is configured at all.
    if (pollyClient && pollyVoice) {
      try {
        const audioBuffer = await synthesizeWithPolly(trimmedText, pollyVoice);
        return sendAudio(res, audioBuffer);
      } catch (pollyError) {
        console.error("[tts] Polly synthesis failed, trying Google fallback:", pollyError.message);
        // fall through to Google below instead of failing here
      }
    } else if (language === "english") {
      console.warn("[tts] AWS Polly isn't configured — using Google Translate TTS for English instead.");
    }

    // 2) Google Translate TTS — Tamil's only option, and English's
    // fallback whenever Polly is unavailable or just failed above.
    if (googleLangCode) {
      try {
        const audioBuffer = await synthesizeWithGoogleTranslate(trimmedText, googleLangCode);
        return sendAudio(res, audioBuffer);
      } catch (googleError) {
        console.error("[tts] Google Translate TTS failed:", googleError.message);
        return res.status(422).json({
          success: false,
          unsupported: true,
          message: `Voice synthesis is temporarily unavailable for "${language}" — use the browser voice fallback.`,
        });
      }
    }

    // 3) No provider at all for this language.
    return res.status(422).json({
      success: false,
      unsupported: true,
      message: `No voice provider is configured for "${language}" — use the browser voice fallback.`,
    });
  } catch (error) {
    console.error("[tts] Speech synthesis failed:", error.message);
    // Degrade to "unsupported" rather than a hard error, so an
    // unexpected failure (e.g. the Chatbot lookup itself) doesn't break
    // the whole voice widget — it just silently uses the browser voice.
    res.status(422).json({ success: false, unsupported: true, message: "Voice synthesis is temporarily unavailable." });
  }
};

async function synthesizeWithPolly(text, voice) {
  const command = new SynthesizeSpeechCommand({
    Text: text,
    OutputFormat: "mp3",
    VoiceId: voice.voiceId,
    LanguageCode: voice.languageCode,
    Engine: voice.engine || "neural",
  });
  const pollyResponse = await pollyClient.send(command);
  return streamToBuffer(pollyResponse.AudioStream);
}

function sendAudio(res, audioBuffer) {
  res.set({
    "Content-Type": "audio/mpeg",
    "Content-Length": audioBuffer.length,
    "Cache-Control": "no-store",
  });
  return res.status(200).send(audioBuffer);
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}