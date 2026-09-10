const express = require("express");
const router = express.Router();

const { uploadFormFiles } = require("../middlewares/uploadMiddleware");

const {
  getBotBySlug,
  getBotByApiKey,
  getBotBySubdomain,
  submitQuery,
} = require("../controllers/publicBotController");
const { synthesizeSpeech } = require("../controllers/ttsController");

// Programmatic access via API key (header: x-api-key)
router.get("/bots/key", getBotByApiKey);

// Vanity-subdomain landing consumption, e.g. muthuwinss.geninuety.com ->
// resolved by the frontend's hostname-detection in main.jsx.
router.get("/bots/subdomain/:subdomain", getBotBySubdomain);

// Link / QR landing consumption
router.get("/bots/:slug", getBotBySlug);
// uploadFormFiles = multer.any(): accepts the legacy single "attachment"
// field AND any number of Admin-defined dynamic form file fields, since
// their field names aren't known ahead of time.
router.post("/bots/:slug/queries", uploadFormFiles, submitQuery);

// AI Voice Assistant (mode: "voice") — text -> AWS Polly speech (audio/mpeg).
// Returns 422 { unsupported: true } for languages Polly can't speak (Tamil)
// or if AWS isn't configured, so the widget falls back to the browser voice.
router.post("/bots/:slug/tts", synthesizeSpeech);

module.exports = router;