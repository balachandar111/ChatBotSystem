const mongoose = require("mongoose");

/*
|--------------------------------------------------------------------------
| Admin
|--------------------------------------------------------------------------
| Created by Superadmin. Superadmin controls:
|   - status (ACTIVE / INACTIVE)          -> account activation/deactivation
|   - access.chatbot                      -> can build & manage chatbots
|                                             (Product Chatbot / Overall Chatbot,
|                                             normal text flow -> "ramajeyam" style engine)
|   - access.voiceChatbot                 -> can build & use the AI Voice Chatbot
|                                             ("manimark" style engine, TTS enabled)
|   - access.manualQueryUpload            -> can bulk-upload queries/FAQs manually
|                                             (Excel upload, no bot flow needed)
*/

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    company: { type: String, default: "" },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: "" },
    phone: { type: String, default: "" },
    password: { type: String, required: true },
    profile: { type: String, default: "" },

    role: {
      type: String,
      enum: ["ADMIN"],
      default: "ADMIN",
    },

    // Vanity subdomain shared by every chatbot this Admin publishes, e.g.
    // "muthuwinss" -> https://muthuwinss.geninuety.com/bot/<slug> for each
    // of their bots. Set via PUT /api/admin/subdomain (self-service) or
    // PUT /api/superadmin/admins/:id/subdomain (superadmin override). See
    // backend/utils/subdomain.js for validation rules and DOMAIN_SETUP.md
    // for the DNS/hosting side.
    subdomain: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    access: {
      chatbot: { type: Boolean, default: false }, // create/manage chatbot (normal)
      voiceChatbot: { type: Boolean, default: false }, // AI voice chatbot
      manualQueryUpload: { type: Boolean, default: false }, // bulk upload queries
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);