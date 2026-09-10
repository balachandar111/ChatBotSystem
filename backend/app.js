const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

require("dotenv").config();

const app = express();

/* =========================
   CORS
========================= */
const allowedOrigins = (process.env.CLIENT_ORIGIN || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isDev = (process.env.NODE_ENV || "development") !== "production";
const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

// Every published chatbot's own vanity subdomain (e.g.
// https://muthuwinss.geninuety.com) is a distinct browser origin that also
// needs to call this API directly (fetching bot config, submitting
// queries, TTS, ...), so any subdomain of BASE_DOMAIN is allowed in
// addition to the explicit CLIENT_ORIGIN list. Configure BASE_DOMAIN in
// backend/.env (e.g. "geninuety.com").
const BASE_DOMAIN = (process.env.BASE_DOMAIN || "").trim().toLowerCase();

const isAllowedSubdomainOrigin = (origin) => {
  if (!BASE_DOMAIN) return false;
  try {
    const { hostname } = new URL(origin);
    const host = hostname.toLowerCase();
    return host === BASE_DOMAIN || host.endsWith(`.${BASE_DOMAIN}`);
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin(origin, callback) {
      // No origin: server-to-server calls, curl, Postman, external API/QR consumers
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes("*")) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (isDev && localhostRegex.test(origin)) return callback(null, true);
      if (isAllowedSubdomainOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

/* =========================
   BODY PARSER & LOGGING
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (isDev) app.use(morgan("dev"));

/* =========================
   STATIC ASSETS
   Serves backend/public/widget-loader.js at GET /widget-loader.js — the
   plain-JS embed snippet an Admin pastes into their own website when a
   chatbot is published in "widget" (Website Widget) display mode. See
   chatbotController.generateChatbot() for where the <script> tag is built.
========================= */
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   ROUTES
========================= */
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/superadmin", require("./routes/superAdminRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/chatbots", require("./routes/chatbotRoutes"));
app.use("/api/queries", require("./routes/queryRoutes"));
app.use("/api/manual-queries", require("./routes/manualUploadRoutes"));

// Public, unauthenticated -> consumed via the generated link / QR / API key
app.use("/api/public", require("./routes/publicRoutes"));

/* =========================
   HEALTH / TEST
========================= */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Chatbot Management System Backend Running 🚀",
  });
});

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route Not Found" });
});

/* =========================
   GLOBAL ERROR HANDLER
   (multer errors etc. land here if a controller didn't already respond)
========================= */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

module.exports = app;