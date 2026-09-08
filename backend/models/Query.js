const mongoose = require("mongoose");

/*
|--------------------------------------------------------------------------
| Query
|--------------------------------------------------------------------------
| Every customer interaction (chatbot path taken, or a manually uploaded
| query/FAQ record) is stored here so the Admin can see it in the Queries
| table.
*/

const pathStepSchema = new mongoose.Schema(
  {
    questionKey: { type: String },
    questionText: { type: String },
    selectedLabel: { type: String },
    selectedText: { type: String },
  },
  { _id: false }
);

const querySchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },

    chatbot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chatbot",
      default: null, // null when source === "manual"
    },

    source: {
      type: String,
      enum: ["normal", "voice", "manual"],
      required: true,
    },

    sessionId: { type: String, default: "" },
    language: { type: String, enum: ["english", "tamil"], default: "english" },

    // The sequence of question/option choices the customer made
    path: { type: [pathStepSchema], default: [] },

    // Free-form fields captured from the customer (contact form at the end
    // of a flow, or a manually uploaded record)
    customerName: { type: String, default: "" },
    contactNumber: { type: String, default: "" },
    email: { type: String, default: "" },
    message: { type: String, default: "" },
    attachmentUrl: { type: String, default: null }, // single-attachment, back-compat

    // Answers captured from an Admin-defined dynamic "form" node
    // (name/number/date/description/... whatever fields the Admin added).
    formResponses: {
      type: [{ key: String, label: String, value: String }],
      default: [],
    },

    // File(s) uploaded through a dynamic "form" node's file field(s),
    // stored on Cloudinary.
    attachments: {
      type: [{ key: String, label: String, url: String }],
      default: [],
    },

    status: {
      type: String,
      enum: ["new", "in_progress", "resolved"],
      default: "new",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Query", querySchema);
