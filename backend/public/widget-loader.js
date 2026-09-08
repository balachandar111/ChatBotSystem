/*
 * Chatbot Management System — Website Widget loader
 * ---------------------------------------------------------------------
 * Generated & served automatically for chatbots published in "Website
 * Widget" display mode (see backend/controllers/chatbotController.js ->
 * generateChatbot, and ChatbotBuilder.jsx's Publish & Share tab).
 *
 * The Admin pastes a snippet like this into their own site's HTML:
 *
 *   <script src="https://your-app.com/widget-loader.js"
 *           data-bot="muthu-winss-rice-abc123"
 *           data-base="https://your-app.com"
 *           async></script>
 *
 * This file is plain, dependency-free JS (no React/build step needed on
 * the customer's site). It:
 *   1. Reads data-bot (slug) + data-base (this app's origin) off its own
 *      <script> tag.
 *   2. Injects a small floating round launcher button, bottom-right.
 *   3. On click, opens the published bot (GET /bot/:slug?embed=1) inside
 *      an iframe panel anchored to the same corner — desktop gets a fixed
 *      380x640 card, mobile expands to fill the screen.
 *
 * The `embed=1` query param tells BotWidget.jsx (frontend/src/widget/
 * BotWidget.jsx) to render edge-to-edge (no outer page padding/gradient),
 * since it's filling an iframe rather than being visited directly.
 */
(function () {
  var thisScript = document.currentScript;
  var slug = thisScript && thisScript.getAttribute("data-bot");
  var base = (thisScript && thisScript.getAttribute("data-base")) || "";

  if (!slug) {
    console.error("[chatbot-widget] Missing data-bot attribute on the widget-loader.js <script> tag.");
    return;
  }
  base = base.replace(/\/$/, "");

  var OPEN_ICON =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.2-3.6A7.96 7.96 0 0 1 4 12Z" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";
  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
    "</svg>";

  var state = { open: false, accent: "#3b3486", loaded: false };

  var launcher = document.createElement("button");
  launcher.setAttribute("aria-label", "Open chat");
  launcher.style.cssText = [
    "position:fixed",
    "bottom:22px",
    "right:22px",
    "width:58px",
    "height:58px",
    "border-radius:50%",
    "border:none",
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "box-shadow:0 10px 26px rgba(0,0,0,0.28)",
    "z-index:2147483000",
    "background:" + state.accent,
    "transition:transform .15s ease, box-shadow .15s ease",
  ].join(";");
  launcher.innerHTML = OPEN_ICON;
  launcher.onmouseenter = function () {
    launcher.style.transform = "translateY(-2px)";
  };
  launcher.onmouseleave = function () {
    launcher.style.transform = "translateY(0)";
  };

  var panelWrap = document.createElement("div");
  panelWrap.style.cssText = [
    "position:fixed",
    "bottom:92px",
    "right:22px",
    "width:380px",
    "height:640px",
    "max-width:calc(100vw - 24px)",
    "max-height:calc(100vh - 116px)",
    "border-radius:18px",
    "overflow:hidden",
    "box-shadow:0 20px 55px rgba(0,0,0,0.32)",
    "z-index:2147483000",
    "display:none",
    "background:#fff",
  ].join(";");

  var iframe = document.createElement("iframe");
  iframe.title = "Chat";
  iframe.style.cssText = "width:100%;height:100%;border:0;display:block;";
  iframe.setAttribute("allow", "autoplay");
  panelWrap.appendChild(iframe);

  function applyMobileLayout() {
    var isMobile = window.innerWidth <= 520;
    if (isMobile) {
      panelWrap.style.top = "0";
      panelWrap.style.left = "0";
      panelWrap.style.right = "0";
      panelWrap.style.bottom = "0";
      panelWrap.style.width = "100%";
      panelWrap.style.height = "100%";
      panelWrap.style.maxWidth = "100vw";
      panelWrap.style.maxHeight = "100vh";
      panelWrap.style.borderRadius = "0";
    } else {
      panelWrap.style.top = "";
      panelWrap.style.left = "";
      panelWrap.style.bottom = "92px";
      panelWrap.style.right = "22px";
      panelWrap.style.width = "380px";
      panelWrap.style.height = "640px";
      panelWrap.style.maxWidth = "calc(100vw - 24px)";
      panelWrap.style.maxHeight = "calc(100vh - 116px)";
      panelWrap.style.borderRadius = "18px";
    }
  }

  function toggle() {
    state.open = !state.open;
    if (state.open) {
      if (!state.loaded) {
        iframe.src = base + "/bot/" + encodeURIComponent(slug) + "?embed=1";
        state.loaded = true;
      }
      applyMobileLayout();
      panelWrap.style.display = "block";
      launcher.innerHTML = CLOSE_ICON;
      launcher.setAttribute("aria-label", "Close chat");
    } else {
      panelWrap.style.display = "none";
      launcher.innerHTML = OPEN_ICON;
      launcher.setAttribute("aria-label", "Open chat");
    }
  }

  launcher.addEventListener("click", toggle);
  window.addEventListener("resize", function () {
    if (state.open) applyMobileLayout();
  });

  // Best-effort: fetch the bot's public config so the launcher can use the
  // Admin's accent color / logo instead of the generic default. Failure
  // here is silent — the launcher still works with default styling.
  fetch(base + "/api/public/bots/" + encodeURIComponent(slug))
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (json) {
      var theme = json && json.data && json.data.theme;
      if (theme && theme.accentColor) {
        state.accent = theme.accentColor;
        launcher.style.background = state.accent;
      }
      if (theme && theme.logoUrl) {
        launcher.innerHTML = "";
        var img = document.createElement("img");
        img.src = theme.logoUrl;
        img.alt = "";
        img.style.cssText = "width:60%;height:60%;object-fit:contain;border-radius:50%;pointer-events:none;";
        launcher.appendChild(img);
      }
    })
    .catch(function () {
      /* ignore — launcher already renders with sensible defaults */
    });

  function mount() {
    document.body.appendChild(panelWrap);
    document.body.appendChild(launcher);
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount);
  }
})();