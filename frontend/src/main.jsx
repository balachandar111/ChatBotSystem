import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import BotWidget from "./widget/BotWidget.jsx";
import "./index.css";

/*
|--------------------------------------------------------------------------
| Subdomain-per-chatbot hosting
|--------------------------------------------------------------------------
| An Admin can give any chatbot a vanity subdomain (e.g. "muthuwinss" ->
| https://muthuwinss.geninuety.com, "ramajeyam" -> https://ramajeyam.
| geninuety.com — see ChatbotBuilder.jsx's "Publish & Share" tab and
| backend/controllers/chatbotController.js -> updateSubdomain).
|
| A visitor hitting that hostname directly should land straight on that
| bot's chat experience at "/" — no /bot/:slug path, no admin login shell.
| We detect that entirely on the client: if the current hostname is exactly
| one level below VITE_BASE_DOMAIN (and isn't a reserved/admin hostname
| like "www" or "app"), we mount <BotWidget subdomain="..."> directly
| instead of the normal admin <App />.
|
| This assumes the SAME frontend build is served for the root domain AND
| every wildcard subdomain (one Vercel project + one wildcard domain, or
| equivalent) — see DOMAIN_SETUP.md for the DNS/hosting side of this.
*/
const BASE_DOMAIN = (import.meta.env.VITE_BASE_DOMAIN || "").trim().toLowerCase();

// Hostnames that belong to the admin app itself, even if hosted as a
// subdomain of BASE_DOMAIN (e.g. "app.geninuety.com" for the dashboard).
const RESERVED_HOSTS = new Set(["www", "app", "admin", "api"]);

function resolveBotSubdomain() {
  if (!BASE_DOMAIN) return null;

  const host = window.location.hostname.toLowerCase();

  if (host === BASE_DOMAIN) return null; // root domain -> admin app
  if (host === "localhost" || host === "127.0.0.1") return null;
  if (!host.endsWith(`.${BASE_DOMAIN}`)) return null; // unrelated domain -> admin app

  const sub = host.slice(0, host.length - (BASE_DOMAIN.length + 1)); // strip ".BASE_DOMAIN"
  if (!sub || sub.includes(".") || RESERVED_HOSTS.has(sub)) return null; // only a single-level subdomain counts

  return sub;
}

const botSubdomain = resolveBotSubdomain();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {botSubdomain ? (
        // Standalone chatbot subdomain: skip auth/admin routing entirely.
        <BotWidget subdomain={botSubdomain} />
      ) : (
        <AuthProvider>
          <App />
        </AuthProvider>
      )}
    </BrowserRouter>
  </React.StrictMode>
);