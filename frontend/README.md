# Chatbot Management System — Frontend

React + Vite frontend for the Chatbot Management System, wired to the companion backend
(`chatbot-management-system-backend`). Structured after the **Service CRM** reference frontend
(role-based pages under `pages/superadmin` and `pages/admin`, a shared `AuthContext`, a
`ProtectedRoute`), with a public chatbot widget modeled on the **ramajeyam-chatbot** (normal/text)
and **ManiMark** (AI Voice) reference bots.

---

## 1. Setup

```bash
cd frontend
npm install
cp .env.example .env      # point VITE_API_BASE_URL at your backend
npm run dev                # http://localhost:5173
```

Log in as Superadmin first (seed one on the backend with `npm run seed:superadmin`), create an
Admin and grant access, then log in as that Admin to build chatbots.

---

## 2. Structure

```
src/
├── api/axios.js              axios instance, attaches JWT, redirects to /login on 401
├── context/AuthContext.jsx   holds the logged-in user, superadmin/admin login methods
├── routes/ProtectedRoute.jsx role-gated route wrapper
├── components/
│   ├── Layout.jsx             sidebar + topbar shell, role-aware nav
│   ├── StatCard.jsx, StatusBadge.jsx, Modal.jsx, Loader.jsx
├── pages/
│   ├── auth/Login.jsx                  single login screen, Admin/Superadmin tabs
│   ├── superadmin/
│   │   ├── SuperAdminDashboard.jsx
│   │   └── AdminList.jsx               create admin, activation, per-feature access toggles
│   └── admin/
│       ├── AdminDashboard.jsx
│       ├── Products.jsx                backs Product Chatbots
│       ├── Queries.jsx                 filterable table of all customer queries
│       ├── ManualUpload.jsx            Excel bulk upload (gated by access.manualQueryUpload)
│       └── chatbot/
│           ├── ChatbotList.jsx         create Product/Overall chatbot, pick engine
│           └── ChatbotBuilder.jsx      dynamic question/option tree editor + Publish tab
└── widget/                              PUBLIC, unauthenticated — what the generated link/QR opens
    ├── BotWidget.jsx                    loads bot by slug, language switcher, picks engine
    ├── useChatFlow.js                   shared client-side tree traversal
    ├── NormalEngine.jsx                 ramajeyam-style text/button chat
    ├── VoiceEngine.jsx                  ManiMark-style TTS voice chat
    └── QueryForm.jsx                    end-of-flow contact capture -> POST query
```

---

## 3. How it maps to the backend

| UI | Calls |
|---|---|
| Login (Admin/Superadmin tabs) | `POST /api/auth/admin/login`, `/api/auth/superadmin/login` |
| Admins & Activation | `/api/superadmin/admins*` (create, list, `/status`, `/access`) |
| Chatbot list / create | `/api/chatbots` |
| Flow Builder tab | `PUT /api/chatbots/:id/flow` |
| Publish & Share tab | `POST /api/chatbots/:id/generate`, `GET /api/chatbots/:id/qr.png` |
| Queries table | `/api/queries*` |
| Manual Upload | `/api/manual-queries/sample`, `/api/manual-queries/upload` |
| Public bot widget (`/bot/:slug`) | `GET /api/public/bots/:slug`, `POST /api/public/bots/:slug/queries` |

The **Flow Builder** edits the same node-map shape the backend validates (`start` + `questions`,
each with `text`, `options[{label, text, next}]`, `isEnd`) — so what you build maps 1:1 onto the
tree stored in MongoDB, no transformation layer needed.

The **engine picker** in "New Chatbot" only allows `AI Voice Chatbot` if the logged-in Admin's
`access.voiceChatbot` is `true` (mirrors the backend's own gate) — otherwise it's shown disabled
with an explanation.

---

## 4. Design notes

- Palette: deep indigo `#3b3486` (brand/primary), jade `#14b8a6` (active/published/voice), amber
  `#e2a63b` (draft/pending) on a cool `#f3f5fa` workspace background.
- Type: Manrope for headings, Inter for UI text, IBM Plex Mono for slugs/API keys/counts.
- The sidebar mark is a literal branching question-tree (root → two branches → four leaves) —
  the actual mechanic of the product, not a generic logo.

---

*Pairs with the `chatbot-management-system-backend` project.*
