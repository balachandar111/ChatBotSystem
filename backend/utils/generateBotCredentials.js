const crypto = require("crypto");

/**
 * Build a URL-safe slug from the bot name + a short random suffix,
 * e.g. "Rice Order Help" -> "rice-order-help-4f9a2c"
 */
const generateSlug = (name) => {
  const base = name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base || "bot"}-${suffix}`;
};

/**
 * Generate a random API key for external/programmatic access to a bot.
 */
const generateApiKey = () => {
  return `cbk_${crypto.randomBytes(24).toString("hex")}`;
};

module.exports = { generateSlug, generateApiKey };
