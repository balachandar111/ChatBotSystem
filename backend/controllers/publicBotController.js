const Chatbot = require("../models/Chatbot");
const Query = require("../models/Query");
const { uploadBufferToCloudinary } = require("../utils/cloudinaryUpload");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/
const sanitizeBot = (chatbot) => {
  const flowObj = chatbot.flow instanceof Map ? Object.fromEntries(chatbot.flow) : chatbot.flow;

  // Convert nested Map (per-node "questions") to plain objects for JSON output
  const flow = {};
  for (const [lang, langFlow] of Object.entries(flowObj || {})) {
    const questions =
      langFlow.questions instanceof Map ? Object.fromEntries(langFlow.questions) : langFlow.questions;
    flow[lang] = { start: langFlow.start, questions };
  }

  return {
    id: chatbot._id,
    slug: chatbot.slug, // included so the widget can submit queries/TTS via /api/public/bots/:slug/... regardless of which host served the page
    name: chatbot.name,
    type: chatbot.type,
    mode: chatbot.mode, // "normal" -> ramajeyam-style engine, "voice" -> manimark-style engine
    // "fullscreen" -> render edge-to-edge; "widget" -> the bot is normally
    // opened inside the widget-loader.js iframe panel (see BotWidget.jsx)
    displayMode: chatbot.displayMode || "fullscreen",
    languages: chatbot.languages,
    flow,
    // Admin-set branding for the widget (logo, title, colors, background).
    // Every field is optional; blank/missing means "use the built-in
    // default" — see the fallback values in BotWidget.jsx / widget.css.
    theme: chatbot.theme ? (chatbot.theme.toObject ? chatbot.theme.toObject() : chatbot.theme) : {},
  };
};

/*
|--------------------------------------------------------------------------
| GET /api/public/bots/:slug
|--------------------------------------------------------------------------
| Used by the link and the page the QR code points to. Loads the whole
| conversation tree so the widget can run entirely client-side, same as
| the ramajeyam/manimark reference bots.
*/
exports.getBotBySlug = async (req, res) => {
  try {
    const chatbot = await Chatbot.findOne({ slug: req.params.slug, status: "published" });

    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    res.status(200).json({ success: true, data: sanitizeBot(chatbot) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/public/bots/key
|--------------------------------------------------------------------------
| Programmatic/API access. Requires header: x-api-key
| Used when a third-party system wants to pull the bot config directly.
*/
exports.getBotByApiKey = async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return res.status(401).json({ success: false, message: "Missing x-api-key header" });
    }

    const chatbot = await Chatbot.findOne({ apiKey, status: "published" });

    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found for this API key" });
    }

    res.status(200).json({ success: true, data: sanitizeBot(chatbot) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/public/bots/:slug/queries
|--------------------------------------------------------------------------
| Customer submits the path they walked through the bot, and either:
|   (a) the plain legacy contact form (customerName/contactNumber/email/
|       message + a single optional "attachment" file), or
|   (b) an Admin-defined dynamic "form" node — arbitrary field keys as text
|       body fields, plus any file-type fields sent as multipart files
|       (fieldname === the field's key). Send `fieldsMeta` (JSON string of
|       [{ key, label, fieldType }]) alongside so we can label the answers
|       and know which fieldnames are files vs text.
|
| Files are uploaded straight to Cloudinary; nothing touches local disk.
|
| body (multipart/form-data):
|   sessionId, language, path (JSON string), fieldsMeta (JSON string, optional),
|   customerName?, contactNumber?, email?, message?, ...dynamic field keys,
|   files: attachment (legacy) and/or <fieldKey> per dynamic file field
*/
exports.submitQuery = async (req, res) => {
  try {
    const chatbot = await Chatbot.findOne({ slug: req.params.slug, status: "published" });

    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    const { sessionId, language, customerName, contactNumber, email, message } = req.body;

    let path = [];
    if (req.body.path) {
      try {
        path = typeof req.body.path === "string" ? JSON.parse(req.body.path) : req.body.path;
      } catch {
        path = [];
      }
    }

    let fieldsMeta = [];
    if (req.body.fieldsMeta) {
      try {
        fieldsMeta = JSON.parse(req.body.fieldsMeta);
      } catch {
        fieldsMeta = [];
      }
    }

    // Upload every file that came in (dynamic form file fields, and/or the
    // legacy single "attachment" input) to Cloudinary.
    const files = req.files || [];
    const attachments = [];
    let attachmentUrl = req.body.attachmentUrl || null;

    for (const file of files) {
      const { url } = await uploadBufferToCloudinary(file.buffer, {
        folder: "chatbot-query-attachments",
        resourceType: "auto",
      });

      const meta = fieldsMeta.find((f) => f.key === file.fieldname);
      if (file.fieldname === "attachment" && !meta) {
        attachmentUrl = url; // legacy single-attachment contact form
      } else {
        attachments.push({ key: file.fieldname, label: meta?.label || file.fieldname, url });
      }
    }

    // Any non-file fields described by fieldsMeta become labeled form responses
    const formResponses = [];
    for (const field of fieldsMeta) {
      if (field.fieldType === "file") continue; // already handled above as an attachment
      const value = req.body[field.key];
      if (value !== undefined && value !== "") {
        formResponses.push({ key: field.key, label: field.label, value });
      }
    }

    const query = await Query.create({
      admin: chatbot.admin,
      chatbot: chatbot._id,
      source: chatbot.mode === "voice" ? "voice" : "normal",
      sessionId,
      language,
      path,
      customerName: customerName || "",
      contactNumber: contactNumber || "",
      email: email || "",
      message: message || "",
      attachmentUrl,
      formResponses,
      attachments,
    });

    res.status(201).json({ success: true, message: "Query submitted", data: query });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};