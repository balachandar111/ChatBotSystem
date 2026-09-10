const Chatbot = require("../models/Chatbot");
const Product = require("../models/Product");
const { generateSlug, generateApiKey } = require("../utils/generateBotCredentials");
const { generateQrDataUrl } = require("../utils/generateQr");
const { uploadBufferToCloudinary } = require("../utils/cloudinaryUpload");
const { parseFlowWorkbook, flowToWorkbookBuffer, buildTemplateWorkbookBuffer } = require("../utils/flowExcel");

// Root domain vanity subdomains are cut from, e.g. "geninuety.com" so an
// admin-chosen subdomain "muthuwinss" resolves to muthuwinss.geninuety.com.
// Configure via BASE_DOMAIN in backend/.env.
const BASE_DOMAIN = (process.env.BASE_DOMAIN || "geninuety.com").trim().toLowerCase();

// Hostnames that must never be handed out as a chatbot's subdomain because
// they're reserved for the platform itself (or common infra conventions).
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "superadmin",
  "mail",
  "smtp",
  "ftp",
  "static",
  "assets",
  "cdn",
  "blog",
  "shop",
  "store",
  "dashboard",
  "portal",
  "support",
  "help",
  "docs",
  "status",
  "dev",
  "staging",
  "test",
  "ns1",
  "ns2",
]);

// A single DNS label: lowercase letters, digits, hyphens; can't start/end
// with a hyphen; 1-63 chars.
const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;


/*
|--------------------------------------------------------------------------
| Flow validation
|--------------------------------------------------------------------------
| Makes sure each language's tree is well formed before it can be saved/
| published: every node referenced by "next"/"productsNext"/"formNext" must
| exist, and every node's required content is present for its nodeType:
|
|   "message"  (default) -> at least one option, unless isEnd
|   "products"            -> at least one product card with a title
|   "form"                -> at least one field with a key + label
|   "steps"               -> at least one step with a title
*/
const validateFlow = (flow) => {
  for (const [language, languageFlow] of Object.entries(flow || {})) {
    if (!languageFlow?.start) {
      return `Missing start node for language "${language}"`;
    }

    const questions = languageFlow.questions || {};

    if (!questions[languageFlow.start]) {
      return `Start node "${languageFlow.start}" not found in "${language}" questions`;
    }

    // Guards against a real bug we hit in production: deleting/rebuilding a
    // node that happened to be the current start silently reassigned
    // `start` to whatever key came first in the questions object (see
    // ChatbotBuilder.removeNode / flowExcel's default-start fallback) —
    // which, if that first key happened to be a closing "Thank you for
    // visiting…" message, made the bot open on the goodbye message instead
    // of the real first question. Block publish instead of shipping that.
    const startNode = questions[languageFlow.start];
    if ((startNode.nodeType || "message") === "message" && startNode.isEnd) {
      return (
        `Start node "${languageFlow.start}" (${language}) is marked as an ending message, so the bot would ` +
        `finish the conversation immediately instead of asking anything. Open the Chatbot Builder, go to the ` +
        `"${language}" tab, and use the "Start question" dropdown to pick the real first question.`
      );
    }

    for (const [key, node] of Object.entries(questions)) {
      const nodeType = node.nodeType || "message";

      if (nodeType === "message") {
        if (!node.isEnd && (!node.options || node.options.length === 0)) {
          return `Question "${key}" (${language}) must have at least one option, or be marked isEnd`;
        }

        for (const option of node.options || []) {
          if (option.next && !questions[option.next]) {
            return `Option "${option.label}" in "${key}" (${language}) points to missing node "${option.next}"`;
          }
        }
      }

      if (nodeType === "products") {
        if (!node.products || node.products.length === 0) {
          return `Products node "${key}" (${language}) must have at least one product card`;
        }
        for (const product of node.products) {
          if (!product.title) {
            return `A product card in "${key}" (${language}) is missing a title`;
          }
        }
        if (node.productsNext && !questions[node.productsNext]) {
          return `Products node "${key}" (${language}) "Continue" points to missing node "${node.productsNext}"`;
        }
      }

      if (nodeType === "form") {
        if (!node.formFields || node.formFields.length === 0) {
          return `Form node "${key}" (${language}) must have at least one field`;
        }
        const seenKeys = new Set();
        for (const field of node.formFields) {
          if (!field.key || !field.label) {
            return `A field in form node "${key}" (${language}) is missing a key or label`;
          }
          if (seenKeys.has(field.key)) {
            return `Form node "${key}" (${language}) has a duplicate field key "${field.key}"`;
          }
          seenKeys.add(field.key);
        }
        if (node.formNext && !questions[node.formNext]) {
          return `Form node "${key}" (${language}) points to missing node "${node.formNext}"`;
        }
      }

      if (nodeType === "steps") {
        if (!node.steps || node.steps.length === 0) {
          return `Steps node "${key}" (${language}) must have at least one instruction step`;
        }
        for (const step of node.steps) {
          if (!step.title) {
            return `A step in "${key}" (${language}) is missing a title`;
          }
        }
        if (node.stepsNext && !questions[node.stepsNext]) {
          return `Steps node "${key}" (${language}) points to missing node "${node.stepsNext}"`;
        }
      }
    }
  }

  return null; // valid
};

/*
|--------------------------------------------------------------------------
| POST /api/chatbots/upload-image
|--------------------------------------------------------------------------
| Used by the Chatbot Builder when the Admin attaches a photo to a
| "products" node card, or to one of a "steps" node's instruction cards.
| Accepts a single multipart field named "image", uploads it to Cloudinary,
| and returns the hosted URL so the frontend can drop it straight into that
| card's `image` field in the flow JSON.
*/
exports.uploadNodeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }

    const { url } = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "chatbot-products",
      resourceType: "image",
    });

    res.status(200).json({ success: true, message: "Image uploaded", data: { url } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/chatbots/upload-theme-asset
|--------------------------------------------------------------------------
| Used by the Chatbot Builder's Theme Setter tab when the Admin uploads a
| logo or a chat-area background image. Same shape as uploadNodeImage,
| just a separate Cloudinary folder so theme assets don't mix with product
| card images.
*/
exports.uploadThemeAsset = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }

    const { url } = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "chatbot-theme",
      resourceType: "image",
    });

    res.status(200).json({ success: true, message: "Image uploaded", data: { url } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/chatbots/upload-theme-video
|--------------------------------------------------------------------------
| Used by the Chatbot Builder's Theme Setter tab when the Admin uploads an
| ambient background video (played muted + looped behind the whole chat
| window, see theme.bgVideoUrl / theme.bgVideoEnabled). Same pattern as
| uploadThemeAsset, but resourceType "video" and its own Cloudinary folder.
*/
exports.uploadThemeVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No video file uploaded" });
    }

    const { url } = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "chatbot-theme-video",
      resourceType: "video",
    });

    res.status(200).json({ success: true, message: "Video uploaded", data: { url } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/chatbots
|--------------------------------------------------------------------------
| Create a new chatbot shell (draft). type = "product" | "overall".
| mode is auto-set based on the admin's granted access unless the admin only
| has "chatbot" access, in which case it is forced to "normal".
*/
exports.createChatbot = async (req, res) => {
  try {
    const { name, type, product, mode, languages } = req.body;

    if (!["product", "overall"].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be 'product' or 'overall'" });
    }

    let productId = null;
    if (type === "product") {
      if (!product) {
        return res.status(400).json({ success: false, message: "product is required when type is 'product'" });
      }
      const productDoc = await Product.findOne({ _id: product, admin: req.user.id });
      if (!productDoc) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      productId = productDoc._id;
    }

    // Gate "voice" mode behind the admin's voiceChatbot access
    let resolvedMode = "normal";
    if (mode === "voice") {
      if (!req.admin.access.voiceChatbot) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to the AI Voice Chatbot feature",
        });
      }
      resolvedMode = "voice";
    }

    const chatbot = await Chatbot.create({
      admin: req.user.id,
      name,
      type,
      product: productId,
      mode: resolvedMode,
      languages: languages && languages.length ? languages : ["english", "tamil"],
      flow: {},
      status: "draft",
    });

    res.status(201).json({ success: true, message: "Chatbot created", data: chatbot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| PUT /api/chatbots/:id/flow
|--------------------------------------------------------------------------
| Save/update the question+options tree (per language). Can be called
| repeatedly while the admin is building the bot. body: { flow: {...} }
*/
exports.updateFlow = async (req, res) => {
  try {
    const { flow } = req.body;

    const error = validateFlow(flow);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const chatbot = await Chatbot.findOneAndUpdate(
      { _id: req.params.id, admin: req.user.id },
      { flow },
      { new: true }
    );

    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    res.status(200).json({ success: true, message: "Flow saved", data: chatbot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/chatbots/flow-template
|--------------------------------------------------------------------------
| Downloadable starter .xlsx (Instructions + a small worked example across
| all 4 node types) so an Admin can build/edit a flow in Excel instead of
| clicking through the builder node-by-node, then import it with
| importFlowExcel below.
*/
exports.downloadFlowTemplate = async (req, res) => {
  try {
    const buffer = buildTemplateWorkbookBuffer();
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=chatbot-flow-template.xlsx",
    });
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/chatbots/:id/flow/export-excel
|--------------------------------------------------------------------------
| Exports THIS bot's current saved flow as the same .xlsx layout — lets an
| Admin who already built something in the visual builder pull it into
| Excel for bulk edits (e.g. filling in 30 product rows) and re-import.
*/
exports.exportFlowExcel = async (req, res) => {
  try {
    const chatbot = await Chatbot.findOne({ _id: req.params.id, admin: req.user.id });
    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }
    // .flow is a Map of Maps (see generateChatbot for why flattenMaps matters)
    const flowObj = chatbot.toObject({ flattenMaps: true }).flow || {};
    const buffer = flowToWorkbookBuffer(flowObj);
    const safeName = (chatbot.name || "chatbot").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=${safeName}-flow.xlsx`,
    });
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/chatbots/:id/flow/import-excel
|--------------------------------------------------------------------------
| Accepts a single .xlsx/.xls file (multipart field "file"), parses it into
| the same shape the visual builder produces, validates it with the exact
| same rules (validateFlow above), and — if valid — REPLACES this bot's
| entire saved flow with it. Returns the updated chatbot so the Flow
| Builder can refresh its in-editor state immediately.
*/
exports.importFlowExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { flow, error: parseError } = parseFlowWorkbook(req.file.buffer);
    if (parseError) {
      return res.status(400).json({ success: false, message: parseError });
    }

    const validationError = validateFlow(flow);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const chatbot = await Chatbot.findOneAndUpdate(
      { _id: req.params.id, admin: req.user.id },
      { flow },
      { new: true }
    );

    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    const languages = Object.keys(flow);
    const nodeCount = Object.values(flow).reduce((sum, lf) => sum + Object.keys(lf.questions || {}).length, 0);

    res.status(200).json({
      success: true,
      message: `Imported ${nodeCount} node(s) across ${languages.length} language(s) from Excel`,
      data: chatbot,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/chatbots/:id/generate
|--------------------------------------------------------------------------
| "Generate the chatbot": validates the flow is complete, then creates the
| public link, API key, and QR code so it can be used externally.
*/
exports.generateChatbot = async (req, res) => {
  try {
    const chatbot = await Chatbot.findOne({ _id: req.params.id, admin: req.user.id });

    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    // Asked in the UI right before publishing (Publish & Share tab):
    //   "fullscreen" -> standalone full-page chat (default, back-compat)
    //   "widget"     -> also generates an embeddable <script> snippet below
    const { displayMode } = req.body;
    if (displayMode && !["fullscreen", "widget"].includes(displayMode)) {
      return res.status(400).json({ success: false, message: "displayMode must be 'fullscreen' or 'widget'" });
    }
    if (displayMode) chatbot.displayMode = displayMode;

    // NOTE: chatbot.flow is a Map of Maps (flow -> language -> questions).
    // Object.fromEntries() only flattens the outer Map, leaving each
    // language's `questions` as a real Map object. Bracket access like
    // questions[key] silently returns undefined on a Map (only .get(key)
    // works), which made validateFlow wrongly report the start node as
    // "not found" even when it existed. toObject({ flattenMaps: true })
    // recursively converts every nested Map to a plain object instead.
    const flowObj = chatbot.toObject({ flattenMaps: true }).flow;

    if (!flowObj || Object.keys(flowObj).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Add questions and options before generating the chatbot",
      });
    }

    const error = validateFlow(flowObj);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    // Re-use existing credentials if this bot was already generated once
    // (re-generate == re-publish after edits), otherwise create new ones.
    const slug = chatbot.slug || generateSlug(chatbot.name);
    const apiKey = chatbot.apiKey || generateApiKey();
    const pathLink = `${process.env.PUBLIC_APP_URL}/bot/${slug}`;

    // If the admin has already set a vanity subdomain (see updateSubdomain
    // below), that becomes the primary public link/QR target instead of the
    // default /bot/:slug path — e.g. https://muthuwinss.geninuety.com.
    const subdomainLink = chatbot.subdomain ? `https://${chatbot.subdomain}.${BASE_DOMAIN}` : null;
    const publicLink = subdomainLink || pathLink;
    const qrCodeDataUrl = await generateQrDataUrl(publicLink);

    // "Website widget" mode: a small floating chat-bubble launcher the
    // Admin pastes into their own site's HTML. It's a plain <script> tag —
    // no build step / npm install required on the customer's end — served
    // statically from this backend (see backend/public/widget-loader.js).
    // The script reads its own data-* attributes at load time, so nothing
    // needs to be templated/baked in server-side.
    const embedSnippet =
      chatbot.displayMode === "widget"
        ? `<script src="${process.env.PUBLIC_APP_URL}/widget-loader.js" data-bot="${slug}" data-base="${process.env.PUBLIC_APP_URL}" async></script>`
        : null;

    chatbot.slug = slug;
    chatbot.apiKey = apiKey;
    chatbot.publicLink = publicLink;
    chatbot.subdomainLink = subdomainLink;
    chatbot.embedSnippet = embedSnippet;
    chatbot.qrCodeDataUrl = qrCodeDataUrl;
    chatbot.status = "published";
    chatbot.publishedAt = new Date();

    await chatbot.save();

    res.status(200).json({
      success: true,
      message: "Chatbot generated successfully",
      data: {
        id: chatbot._id,
        slug: chatbot.slug,
        apiKey: chatbot.apiKey,
        publicLink: chatbot.publicLink,
        subdomain: chatbot.subdomain,
        subdomainLink: chatbot.subdomainLink,
        embedSnippet: chatbot.embedSnippet,
        qrCodeDataUrl: chatbot.qrCodeDataUrl,
        mode: chatbot.mode,
        type: chatbot.type,
        status: chatbot.status,
        displayMode: chatbot.displayMode,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/chatbots/:id/qr.png
|--------------------------------------------------------------------------
| Streams the QR code as a real PNG (useful for "download QR" buttons).
*/
exports.getQrPng = async (req, res) => {
  try {
    const { generateQrBuffer } = require("../utils/generateQr");
    const chatbot = await Chatbot.findOne({ _id: req.params.id, admin: req.user.id });

    if (!chatbot || !chatbot.publicLink) {
      return res.status(404).json({ success: false, message: "Chatbot not generated yet" });
    }

    const buffer = await generateQrBuffer(chatbot.publicLink);
    res.set("Content-Type", "image/png");
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/chatbots
|--------------------------------------------------------------------------
*/
exports.getChatbots = async (req, res) => {
  try {
    const filter = { admin: req.user.id };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;

    const chatbots = await Chatbot.find(filter).populate("product", "name").sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: chatbots.length, data: chatbots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/chatbots/:id
|--------------------------------------------------------------------------
*/
exports.getChatbot = async (req, res) => {
  try {
    const chatbot = await Chatbot.findOne({ _id: req.params.id, admin: req.user.id }).populate(
      "product",
      "name"
    );

    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    res.status(200).json({ success: true, data: chatbot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| PUT /api/chatbots/:id
|--------------------------------------------------------------------------
| Update basic metadata (name, languages). Flow updates go through
| updateFlow so the shape stays validated.
*/
exports.updateChatbot = async (req, res) => {
  try {
    const { name, languages } = req.body;

    const chatbot = await Chatbot.findOneAndUpdate(
      { _id: req.params.id, admin: req.user.id },
      { ...(name && { name }), ...(languages && { languages }) },
      { new: true }
    );

    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    res.status(200).json({ success: true, message: "Chatbot updated", data: chatbot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| PUT /api/chatbots/:id/theme
|--------------------------------------------------------------------------
| Save/update the widget's theme (logo, title, navbar color, chat area
| color or background image, accent color). body: { theme: {...} }.
| Every field is optional — anything omitted/blank falls back to the
| built-in default in the widget, so the admin can tweak just one thing.
*/
const THEME_FIELDS = [
  "logoUrl",
  "title",
  "subtitle",
  "navBgColor",
  "navTextColor",
  "accentColor",
  "fontFamily",
  "chatBgType",
  "chatBgColor",
  "chatBgImageUrl",
  "bgVideoEnabled",
  "bgVideoUrl",
];

exports.updateTheme = async (req, res) => {
  try {
    const incoming = req.body.theme || {};

    if (incoming.chatBgType && !["color", "image"].includes(incoming.chatBgType)) {
      return res.status(400).json({ success: false, message: "chatBgType must be 'color' or 'image'" });
    }

    const chatbot = await Chatbot.findOne({ _id: req.params.id, admin: req.user.id });
    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    // Merge onto the existing theme so a partial payload (e.g. just the
    // logo) never wipes out the admin's other saved theme choices.
    const current = chatbot.theme ? chatbot.theme.toObject() : {};
    for (const field of THEME_FIELDS) {
      if (incoming[field] !== undefined) current[field] = incoming[field];
    }
    chatbot.theme = current;
    await chatbot.save();

    res.status(200).json({ success: true, message: "Theme saved", data: chatbot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| PUT /api/chatbots/:id/subdomain
|--------------------------------------------------------------------------
| Sets (or clears) this chatbot's vanity subdomain, e.g. an Admin building
| a bot for "Muthu Winss" sets subdomain "muthuwinss" so customers can reach
| it at https://muthuwinss.geninuety.com instead of the default
| /bot/:slug path. Can be called before or after publishing — if the bot is
| already published, its `publicLink`/QR code are refreshed immediately so
| they point at the new subdomain.
|
| body: { subdomain: "muthuwinss" }  — send an empty string to remove the
| subdomain and fall back to the default /bot/:slug link.
|
| NOTE: this only makes the subdomain resolve to the right chatbot *inside*
| this app (via GET /api/public/bots/subdomain/:subdomain, matched by the
| frontend on load — see frontend/src/main.jsx). DNS still needs a wildcard
| record (e.g. "*.geninuety.com") pointed at wherever the frontend is
| hosted, and that wildcard domain added on the hosting side (e.g. Vercel's
| "Domains" settings) — see DOMAIN_SETUP.md.
*/
exports.updateSubdomain = async (req, res) => {
  try {
    const raw = (req.body.subdomain ?? "").toString().trim().toLowerCase();

    const chatbot = await Chatbot.findOne({ _id: req.params.id, admin: req.user.id });
    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }

    // Empty string -> remove the subdomain, revert to the default link.
    if (!raw) {
      chatbot.subdomain = undefined;
      chatbot.subdomainLink = null;
      if (chatbot.status === "published") {
        const pathLink = `${process.env.PUBLIC_APP_URL}/bot/${chatbot.slug}`;
        chatbot.publicLink = pathLink;
        chatbot.qrCodeDataUrl = await generateQrDataUrl(pathLink);
      }
      await chatbot.save();
      return res.status(200).json({ success: true, message: "Subdomain removed", data: chatbot });
    }

    if (!SUBDOMAIN_REGEX.test(raw)) {
      return res.status(400).json({
        success: false,
        message:
          'Subdomain can only contain lowercase letters, numbers and hyphens, and cannot start or end with a hyphen (e.g. "muthuwinss").',
      });
    }

    if (RESERVED_SUBDOMAINS.has(raw)) {
      return res.status(400).json({ success: false, message: `"${raw}" is reserved. Please choose another subdomain.` });
    }

    const clash = await Chatbot.findOne({ subdomain: raw, _id: { $ne: chatbot._id } });
    if (clash) {
      return res.status(409).json({
        success: false,
        message: `"${raw}.${BASE_DOMAIN}" is already taken. Please choose another subdomain.`,
      });
    }

    chatbot.subdomain = raw;
    chatbot.subdomainLink = `https://${raw}.${BASE_DOMAIN}`;

    // Already live? Point the public link/QR at the new subdomain right away.
    if (chatbot.status === "published") {
      chatbot.publicLink = chatbot.subdomainLink;
      chatbot.qrCodeDataUrl = await generateQrDataUrl(chatbot.subdomainLink);
    }

    await chatbot.save();

    res.status(200).json({ success: true, message: "Subdomain saved", data: chatbot });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "That subdomain is already taken. Please choose another." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE /api/chatbots/:id
|--------------------------------------------------------------------------
*/
exports.deleteChatbot = async (req, res) => {
  try {
    const chatbot = await Chatbot.findOneAndDelete({ _id: req.params.id, admin: req.user.id });
    if (!chatbot) {
      return res.status(404).json({ success: false, message: "Chatbot not found" });
    }
    res.status(200).json({ success: true, message: "Chatbot deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};