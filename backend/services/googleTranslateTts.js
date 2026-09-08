/*
|--------------------------------------------------------------------------
| Google Translate TTS (fallback provider for languages Polly can't speak)
|--------------------------------------------------------------------------
| Amazon Polly has no Tamil voice at all (see backend/config/polly.js), so
| Tamil is synthesized via Google Translate's public, key-less TTS endpoint
| instead: https://translate.google.com/translate_tts
|
| This mirrors the request shape used by the standalone Muthu WinSS
| chatbot's backend/routes/voiceRoutes.js (same endpoint, same param set),
| which is the known-working reference for this endpoint — no `idx`/
| `total`/`textlen` params, no `Referer` header, just `ie`/`client`/`tl`/`q`
| plus a browser User-Agent.
|
| The endpoint silently truncates/rejects long inputs (~200 characters per
| request), so text is chunked to 180 chars first, on whitespace where
| possible, and the resulting MP3s are concatenated — raw MP3
| concatenation (no re-encode) plays back fine in browsers/Audio elements.
*/

async function synthesizeWithGoogleTranslate(text, langCode) {
  const chunks = text.match(/.{1,180}(?:\s|$)/g) || [text];
  const buffers = [];

  for (const rawChunk of chunks) {
    const chunk = rawChunk.trim();
    if (!chunk) continue;

    const url =
      "https://translate.google.com/translate_tts" +
      `?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(langCode)}&q=${encodeURIComponent(chunk)}`;

    const response = await fetch(url, {
      headers: {
        // Some deployments of this endpoint reject requests with no UA.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Google Translate TTS responded with ${response.status}`);
    }

    buffers.push(Buffer.from(await response.arrayBuffer()));
  }

  return Buffer.concat(buffers);
}

module.exports = { synthesizeWithGoogleTranslate };