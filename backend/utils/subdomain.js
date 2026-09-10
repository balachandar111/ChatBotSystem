// Shared validation for the vanity subdomain an Admin sets for themselves
// (e.g. "muthuwinss" -> https://muthuwinss.geninuety.com). One subdomain
// per Admin — every chatbot they publish lives under it at /bot/:slug,
// e.g. https://muthuwinss.geninuety.com/bot/rice-order-help-4f9a2c.

// A single DNS label: lowercase letters, digits, hyphens; can't start/end
// with a hyphen; 1-63 chars.
const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// Hostnames that must never be handed out as an Admin's subdomain because
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

/**
 * Normalizes + validates a candidate subdomain.
 * Returns { value: "muthuwinss" } on success, or { error: "..." } on failure.
 * An empty string is valid and means "remove the subdomain".
 */
const validateSubdomain = (raw) => {
  const value = (raw ?? "").toString().trim().toLowerCase();

  if (!value) return { value: "" };

  if (!SUBDOMAIN_REGEX.test(value)) {
    return {
      error:
        'Subdomain can only contain lowercase letters, numbers and hyphens, and cannot start or end with a hyphen (e.g. "muthuwinss").',
    };
  }

  if (RESERVED_SUBDOMAINS.has(value)) {
    return { error: `"${value}" is reserved. Please choose another subdomain.` };
  }

  return { value };
};

// Root domain Admin vanity subdomains are cut from, e.g. "geninuety.com" so
// an admin-chosen subdomain "muthuwinss" resolves to
// muthuwinss.geninuety.com. Configure via BASE_DOMAIN in backend/.env.
const BASE_DOMAIN = (process.env.BASE_DOMAIN || "geninuety.com").trim().toLowerCase();

/**
 * Builds a chatbot's public link: the owning Admin's subdomain (if they've
 * set one) in front of the usual /bot/:slug path, otherwise the default
 * PUBLIC_APP_URL/bot/:slug. Matches the protocol/port of PUBLIC_APP_URL so
 * local testing (e.g. "http://localhost:5173") doesn't silently produce a
 * broken "https://" link — see DOMAIN_SETUP.md.
 */
const buildPublicLink = (adminSubdomain, slug) => {
  const appUrl = new URL(process.env.PUBLIC_APP_URL || "https://example.com");

  if (!adminSubdomain) {
    return `${appUrl.origin}/bot/${slug}`;
  }

  const port = appUrl.port ? `:${appUrl.port}` : "";
  return `${appUrl.protocol}//${adminSubdomain}.${BASE_DOMAIN}${port}/bot/${slug}`;
};

module.exports = { SUBDOMAIN_REGEX, RESERVED_SUBDOMAINS, validateSubdomain, BASE_DOMAIN, buildPublicLink };