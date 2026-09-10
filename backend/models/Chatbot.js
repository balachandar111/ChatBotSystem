const mongoose = require("mongoose");

/*
|--------------------------------------------------------------------------
| Chatbot
|--------------------------------------------------------------------------
| Admin builds a dynamic question/option tree per language. Every node in
| the tree has a `nodeType`:
|
|   "message"  (default, back-compat with older bots that have no nodeType
|                saved at all) -> plain text + tappable options, e.g.:
|
|     "Q1": {
|       nodeType: "message",
|       text: "How can we help you?",
|       options: [
|         { label: "A", text: "Order Issue",  next: "Q1A" },
|         { label: "B", text: "Product Info", next: "Q1B" }
|       ]
|     }
|
|   "products" -> a card grid the Admin fills in (image, title, description,
|                 a redirect button pointing anywhere), e.g.:
|
|     "Q1B": {
|       nodeType: "products",
|       text: "Here's what we've got:",
|       products: [
|         {
|           image: "https://res.cloudinary.com/.../snack-bar.png",
|           title: "Classic Chikki Bar",
|           description: "Peanut jaggery bar, 40g pack",
|           buttonText: "View on Amazon",
|           redirectUrl: "https://amazon.in/..."
|         }
|       ],
|       productsNext: "Q2"   // optional "Continue" button after the grid; null/omit = end
|     }
|
|   "form" -> a dynamic form the Admin defines field-by-field (name, number,
|             date, description, image/file upload, ...), e.g.:
|
|     "Q3": {
|       nodeType: "form",
|       text: "Tell us a bit more:",
|       formFields: [
|         { key: "customerName", label: "Your name", fieldType: "text", required: true },
|         { key: "contactNumber", label: "Phone number", fieldType: "tel", required: true },
|         { key: "preferredDate", label: "Preferred date", fieldType: "date" },
|         { key: "details", label: "Describe the issue", fieldType: "textarea" },
|         { key: "photo", label: "Attach a photo", fieldType: "file" }
|       ],
|       formSubmitLabel: "Submit",
|       formNext: "Q4"   // optional node after submit; null/omit = end (thank-you)
|     }
|
|   "steps" -> an interactive, photo-illustrated step-by-step instruction
|              card (e.g. "how to cook this rice", "how to set this up"),
|              added dynamically by the Admin. Rendered one step at a time
|              on the widget with Back/Next + a progress dial, e.g.:
|
|     "Q4": {
|       nodeType: "steps",
|       text: "Here's how, step by step:",
|       steps: [
|         { image: "https://res.cloudinary.com/.../step1.png", title: "Wash & Soak", desc: "..." },
|         { image: "https://res.cloudinary.com/.../step2.png", title: "Add to Cooker", desc: "..." }
|       ],
|       stepsNext: "Q5"   // optional node after the closing screen; null/omit = end
|     }
|
| A "message" node's options may optionally carry a `url` (see optionSchema
| below) — an external link (YouTube, Instagram, website, ...) opened in a
| new tab when tapped, independent of / in addition to `next`.
|
| type        : "product" (bound to a Product) or "overall" (general/org-wide)
| mode        : "normal"  -> rendered with the ramajeyam-style text/button engine
|                "voice"   -> rendered with the manimark-style AI voice (TTS) engine
|                (mode is gated by the admin's access.voiceChatbot permission)
| status      : "draft" while being built, "published" once generated
|               (link/QR/API key are only created on publish/generate)
|
| Validation of the tree shape (per nodeType) happens in
| chatbotController.validateFlow().
*/

const optionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true }, // A, B, C, D, a, b, ...
    text: { type: String, required: true }, // display text for the option
    next: { type: String, default: null }, // key of the next question node, or null if it leads to an end message
    // Optional external link (e.g. YouTube, Instagram, website). When set,
    // tapping the option opens this URL in a new tab. `next` and `url` can
    // both be set (open link AND advance the flow), or `url` alone (open
    // link, stay on the same node so the customer can pick another option).
    url: { type: String, default: "" },
  },
  { _id: false }
);

// A single step inside a "steps" node (see questionNodeSchema below) —
// mirrors the interactive cooking-instructions card pattern (image + title
// + description, shown one at a time with Back/Next navigation).
const stepItemSchema = new mongoose.Schema(
  {
    image: { type: String, default: "" }, // Cloudinary secure_url; falls back to a generic illustration on the widget
    title: { type: String, required: true },
    desc: { type: String, default: "" },
  },
  { _id: false }
);

// A single card inside a "products" node
const productCardSchema = new mongoose.Schema(
  {
    image: { type: String, default: "" }, // Cloudinary secure_url
    title: { type: String, required: true },
    description: { type: String, default: "" },
    buttonText: { type: String, default: "View" },
    redirectUrl: { type: String, default: "" }, // where the button sends the customer
  },
  { _id: false }
);

// A single field inside a "form" node, defined by the Admin at build time
const formFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // unique within the node, e.g. "customerName"
    label: { type: String, required: true }, // shown to the customer
    fieldType: {
      type: String,
      enum: ["text", "number", "tel", "email", "date", "textarea", "file"],
      default: "text",
    },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
  },
  { _id: false }
);

const questionNodeSchema = new mongoose.Schema(
  {
    nodeType: {
      type: String,
      enum: ["message", "products", "form", "steps"],
      default: "message",
    },

    text: { type: String, default: "" }, // question text (message) / heading (products, form & steps)
    isEnd: { type: Boolean, default: false }, // terminal node (final answer / redirect / raise-a-query)

    // nodeType === "message"
    options: { type: [optionSchema], default: [] },

    // nodeType === "products"
    products: { type: [productCardSchema], default: [] },
    productsNext: { type: String, default: null }, // optional "Continue" button target after the grid

    // nodeType === "form"
    formFields: { type: [formFieldSchema], default: [] },
    formSubmitLabel: { type: String, default: "Submit" },
    formNext: { type: String, default: null }, // node shown after a successful submit

    // nodeType === "steps" -> an interactive, photo-illustrated step-by-step
    // card (e.g. cooking / assembly / usage instructions). Admin adds any
    // number of steps dynamically; the widget shows one at a time with
    // Back/Next controls and a progress dial, finishing on a closing screen.
    steps: { type: [stepItemSchema], default: [] },
    stepsNext: { type: String, default: null }, // optional node after the closing screen
    // Text shown on that closing screen once the customer taps "Finish" on
    // the last step. Optional — the widget falls back to a generic
    // "All done!" message when left blank, so existing bots created before
    // this field existed keep working with no changes needed.
    closingTitle: { type: String, default: "" },
    closingMessage: { type: String, default: "" },
    closingImage: { type: String, default: "" }, // Cloudinary secure_url; falls back to a generic illustration on the widget
  },
  { _id: false }
);

const languageFlowSchema = new mongoose.Schema(
  {
    start: { type: String, required: true }, // key of the first question node
    questions: {
      type: Map,
      of: questionNodeSchema,
      required: true,
    },
  },
  { _id: false }
);

/*
|--------------------------------------------------------------------------
| Theme
|--------------------------------------------------------------------------
| Fully admin-controlled look & feel for the public widget. Everything here
| is optional — an empty/blank field means "use the built-in default" (see
| the fallback values baked into widget.css and BotWidget.jsx), so an admin
| can change just one thing (e.g. only the logo) without having to set
| every field.
|
|   logoUrl        -> Cloudinary URL, shown in the widget header (and as
|                      the bot's avatar next to its messages)
|   title/subtitle -> overrides the header text (defaults to chatbot.name
|                      and a mode-based subtitle when blank)
|   navBgColor     -> header/navbar background color (hex)
|   navTextColor   -> header title/subtitle text color (hex)
|   accentColor    -> buttons, option chips, user bubble, focus rings
|   fontFamily     -> Google Font family name applied across the whole
|                      widget (header, bubbles, chips); blank -> "Inter"
|   chatBgType     -> "color" (use chatBgColor) or "image" (use chatBgImageUrl)
|   chatBgColor    -> chat area background color (hex)
|   chatBgImageUrl -> Cloudinary URL for a chat area background image
|   bgVideoEnabled -> when true (and bgVideoUrl set), an ambient looping,
|                      muted background video plays behind the whole chat
|                      window (purely decorative, pointer-events disabled)
|   bgVideoUrl     -> Cloudinary URL (video) for the background video
*/
const themeSchema = new mongoose.Schema(
  {
    logoUrl: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    navBgColor: { type: String, default: "" },
    navTextColor: { type: String, default: "" },
    accentColor: { type: String, default: "" },
    fontFamily: { type: String, default: "" },
    chatBgType: { type: String, enum: ["color", "image"], default: "color" },
    chatBgColor: { type: String, default: "" },
    chatBgImageUrl: { type: String, default: "" },
    bgVideoEnabled: { type: Boolean, default: false },
    bgVideoUrl: { type: String, default: "" },
  },
  { _id: false }
);

const chatbotSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    name: { type: String, required: true, trim: true },

    type: {
      type: String,
      enum: ["product", "overall"],
      required: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null, // required only when type === "product"
    },

    mode: {
      type: String,
      enum: ["normal", "voice"],
      default: "normal",
    },

    languages: {
      type: [String],
      enum: ["english", "tamil"],
      default: ["english", "tamil"],
    },

    // Map keyed by language ("english" | "tamil") -> languageFlowSchema
    flow: {
      type: Map,
      of: languageFlowSchema,
      default: {},
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    // Admin-set branding/colors for the public widget (see themeSchema above)
    theme: { type: themeSchema, default: () => ({}) },

    // Asked at publish time (see chatbotController.generateChatbot):
    //   "fullscreen" -> the public link opens as a standalone, edge-to-edge
    //                    full-page chat experience (matches the reference
    //                    full-screen chatbot design) — best for QR codes /
    //                    a dedicated "chat with us" page.
    //   "widget"      -> in addition to the link, an embeddable <script>
    //                    snippet is generated: a small floating chat-bubble
    //                    launcher the admin pastes into their own website,
    //                    which opens the bot in a corner panel.
    displayMode: {
      type: String,
      enum: ["fullscreen", "widget"],
      default: "fullscreen",
    },

    // Populated only once the admin clicks "Generate" (publish)
    slug: { type: String, unique: true, sparse: true },
    apiKey: { type: String, unique: true, sparse: true },
    // e.g. https://muthuwinss.geninuety.com/bot/<slug> if the owning Admin
    // has set a subdomain (see Admin.subdomain), otherwise falls back to
    // PUBLIC_APP_URL/bot/<slug>. Recomputed whenever the Admin's subdomain
    // changes (see adminController.updateSubdomain) or the bot is
    // (re-)published (see chatbotController.generateChatbot).
    publicLink: { type: String, default: null },
    embedSnippet: { type: String, default: null }, // only set when displayMode === "widget"
    qrCodeDataUrl: { type: String, default: null }, // base64 PNG data URL

    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chatbot", chatbotSchema);