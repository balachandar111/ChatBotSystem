const { PollyClient } = require("@aws-sdk/client-polly");

/*
|--------------------------------------------------------------------------
| AWS Polly (AI Voice Assistant TTS)
|--------------------------------------------------------------------------
| Reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION from .env.
| If they're missing, `pollyClient` is null and callers should treat that
| the same as "provider unavailable" (see ttsController.js), so a bot
| still works end-to-end (falling back to the browser's own speech
| synthesis) even before AWS credentials are configured.
*/
const hasCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

const pollyClient = hasCreds
  ? new PollyClient({
      region: process.env.AWS_REGION || "ap-south-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

/*
|--------------------------------------------------------------------------
| IMPORTANT — Tamil is not an Amazon Polly language
|--------------------------------------------------------------------------
| As of this writing, Amazon Polly's supported language list does not
| include Tamil (ta-IN) at all — only Hindi (hi-IN) and Indian English
| (en-IN), via the bilingual "Kajal"/"Aditi" voices. See:
|   https://docs.aws.amazon.com/polly/latest/dg/SupportedLanguage.html
|
| So AWS credentials alone can't make a Tamil "AI voice" work through
| Polly — there is no Tamil voice to call. LANGUAGE_VOICE_MAP below only
| lists languages Polly can actually speak; any language not in this map
| (i.e. "tamil") is reported as unsupported by ttsController.js, and the
| frontend (VoiceEngine.jsx) automatically falls back to the browser's
| built-in SpeechSynthesis voice for that language instead.
|
| If true AWS-grade Tamil speech is required, the options are:
|   1. Keep Polly for English/Hindi and rely on the browser voice for
|      Tamil (what this app does out of the box).
|   2. Swap in a provider that *does* support Tamil, e.g. Google Cloud
|      Text-to-Speech (ta-IN Standard/Neural2 voices) or Azure AI Speech
|      (ta-IN voices) — same controller shape, different SDK call.
*/
const LANGUAGE_VOICE_MAP = {
  english: { voiceId: "Kajal", languageCode: "en-IN", engine: "neural" },
};

module.exports = { pollyClient, LANGUAGE_VOICE_MAP };