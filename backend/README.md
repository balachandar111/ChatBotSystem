# Chatbot Management System — Backend

MERN-stack backend for the Chatbot Management System (Node.js / Express / MongoDB / Mongoose).
Structured after the **Service CRM** reference project (config / controllers / middlewares / models / routes / utils),
and models the chatbot **flow + delivery** on the **ramajeyam-chatbot** (normal, text-based) and **ManiMark** (AI Voice)
reference bots.

---

## 1. Roles & Access Model

| Role | Login | Capabilities |
|---|---|---|
| **Superadmin** | `/api/auth/superadmin/login` | Dashboard, create Admins, activate/deactivate Admins, grant/revoke feature access |
| **Admin** | `/api/auth/admin/login` | Dashboard, build & publish chatbots (if granted), view/manage Queries |

Each Admin has three independent, Superadmin-controlled feature flags (`Admin.access`):

| Flag | Unlocks |
|---|---|
| `chatbot` | Base access to the Chatbot module — build Product/Overall chatbots, dynamic question+option flows, publish (generate link/QR/API) |
| `voiceChatbot` | Ability to set a chatbot's `mode` to `"voice"` (AI Voice Chatbot, TTS-driven, ManiMark-style engine) |
| `manualQueryUpload` | Bulk-upload customer queries/FAQs via Excel instead of building a chatbot flow |

An Admin without `chatbot` access is blocked from the entire `/api/chatbots` and `/api/products` routes.
An Admin with `chatbot` but not `voiceChatbot` can only create `mode: "normal"` bots (the ramajeyam-style engine).

Superadmin can deactivate any Admin (`status: "INACTIVE"`), which immediately blocks login and all API calls.

---

## 2. Chatbot Model — Dynamic Question/Option Builder

A chatbot's `flow` is a per-language decision tree, stored as nested data (not code), exactly like the reference
`chatFlow.js` files:

```
flow: {
  english: {
    start: "Q1",
    questions: {
      "Q1":  { text: "How can we help you?", options: [
                { label: "A", text: "Order Issue",  next: "Q1A" },
                { label: "B", text: "Product Info", next: "Q1B" },
                { label: "C", text: "Payment",      next: "Q1C" },
                { label: "D", text: "Other",        next: "Q1D" } ] },
      "Q1A": { text: "What's the issue?", options: [
                { label: "a", text: "Not received", next: "END_NOT_RECEIVED" },
                { label: "b", text: "Damaged",      next: "END_DAMAGED" } ] },
      "END_NOT_RECEIVED": { text: "Sorry, raising a ticket for you.", options: [], isEnd: true }
    }
  },
  tamil: { ... same shape ... }
}
```

This directly matches the requested tree: `Language -> A/B/C/D -> a-b / c-d / e-f / g-h`, and can be extended to any
depth without a schema change. `chatbotController.validateFlow()` checks that every `next` points to a real node and
every non-`isEnd` node has at least one option before it can be saved or published.

### Product vs Overall
- `type: "product"` — bound to a `Product` document (`product` field required). Used for a single product's chatbot.
- `type: "overall"` — general/organization-wide chatbot, no product binding.

### Publishing ("Generate")
`POST /api/chatbots/:id/generate` validates the flow, then creates:
- `slug` — unique URL segment
- `apiKey` — for programmatic/external access
- `publicLink` — `${PUBLIC_APP_URL}/bot/:slug`
- `qrCodeDataUrl` — base64 PNG QR code pointing at `publicLink`

These are exactly the **link, QR, and API** the admin can hand out externally. Re-generating after an edit reuses the
same slug/apiKey (keeps the previously shared link/QR valid).

---

## 3. Project Structure

```
backend/
├── config/db.js                  MongoDB connection
├── controllers/
│   ├── authController.js         superadmin + admin login
│   ├── superAdminController.js   dashboard, admin CRUD, activation, access toggles
│   ├── adminController.js        admin's own dashboard
│   ├── productController.js      products (backing product-chatbots)
│   ├── chatbotController.js      flow builder, validation, publish/generate, QR
│   ├── publicBotController.js    public (no-auth) bot fetch + query submission
│   ├── queryController.js        admin queries table (list/filter/update/delete)
│   └── manualUploadController.js Excel bulk query upload
├── middlewares/
│   ├── authMiddleware.js         JWT verification
│   ├── roleMiddleware.js         SUPER_ADMIN / ADMIN gate
│   ├── accessMiddleware.js       per-feature access gate (chatbot/voiceChatbot/manualQueryUpload)
│   └── uploadMiddleware.js       multer (excel + attachment uploads)
├── models/
│   ├── SuperAdmin.js
│   ├── Admin.js                  incl. `access` sub-document
│   ├── Product.js
│   ├── Chatbot.js                incl. dynamic `flow` tree + publish fields
│   └── Query.js                  incl. `path` (the options a customer picked) + `source`
├── routes/                       one file per resource, mirrors controllers
├── utils/
│   ├── generateToken.js          JWT signing
│   ├── generateBotCredentials.js slug + apiKey generation
│   ├── generateQr.js             QR (data URL + PNG buffer)
│   └── seedSuperAdmin.js         creates the first Superadmin account
├── app.js                        express app, CORS, route mounting, error handler
├── server.js                     entrypoint
└── package.json
```

---

## 4. Setup

```bash
cd backend
npm install
cp .env.example .env      # then edit MONGO_URI, JWT_SECRET, PUBLIC_APP_URL, etc.
npm run seed:superadmin   # creates the first Superadmin login
npm run dev               # starts on http://localhost:5000
```

---

## 5. API Reference

### Auth (public)
| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/auth/superadmin/login` | `{ username, password }` |
| POST | `/api/auth/admin/login` | `{ username, password }` |

All authenticated routes below require `Authorization: Bearer <token>`.

### Superadmin (`SUPER_ADMIN` only)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/superadmin/dashboard` | Platform summary |
| POST | `/api/superadmin/admins` | Create Admin (`{ name, username, password, access:{chatbot,voiceChatbot,manualQueryUpload}, ... }`) |
| GET | `/api/superadmin/admins` | List all Admins (Activation section) |
| GET | `/api/superadmin/admins/:id` | Get one Admin |
| PUT | `/api/superadmin/admins/:id` | Update Admin details |
| PUT | `/api/superadmin/admins/:id/status` | `{ status: "ACTIVE"\|"INACTIVE" }` — activate/deactivate |
| PUT | `/api/superadmin/admins/:id/access` | `{ chatbot, voiceChatbot, manualQueryUpload }` — grant/revoke features |
| DELETE | `/api/superadmin/admins/:id` | Delete Admin |

### Admin
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/dashboard` | Admin's own summary + current `access` |

### Products (requires `access.chatbot`)
| Method | Endpoint |
|---|---|
| POST / GET | `/api/products` |
| PUT / DELETE | `/api/products/:id` |

### Chatbots (requires `access.chatbot`; `mode:"voice"` additionally requires `access.voiceChatbot`)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/chatbots` | Create draft — `{ name, type: "product"\|"overall", product?, mode: "normal"\|"voice", languages? }` |
| GET | `/api/chatbots` | List (filter by `?type=` / `?status=`) |
| GET | `/api/chatbots/:id` | Get one |
| PUT | `/api/chatbots/:id` | Update name/languages |
| PUT | `/api/chatbots/:id/flow` | Save the question/option tree — `{ flow: {...} }` |
| POST | `/api/chatbots/:id/generate` | Publish → returns `slug`, `apiKey`, `publicLink`, `qrCodeDataUrl` |
| GET | `/api/chatbots/:id/qr.png` | Download QR as PNG |
| DELETE | `/api/chatbots/:id` | Delete |

### Queries table
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/queries` | List (filter by `?chatbot=` / `?source=` / `?status=`) |
| GET | `/api/queries/:id` | Get one |
| PATCH | `/api/queries/:id/status` | `{ status: "new"\|"in_progress"\|"resolved" }` |
| DELETE | `/api/queries/:id` | Delete |

### Manual query upload (requires `access.manualQueryUpload`)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/manual-queries/sample` | Download sample `.xlsx` template |
| POST | `/api/manual-queries/upload` | Multipart, field `file` — bulk-creates Query records |

### Public (no auth — this is what the generated Link / QR / API expose externally)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/public/bots/:slug` | Fetch full bot config (name, mode, languages, flow) for the link/QR landing page |
| GET | `/api/public/bots/key` | Same, but via `x-api-key` header — for programmatic/API integration |
| POST | `/api/public/bots/:slug/queries` | Customer submits the path they took (+ optional contact fields, multipart `attachment`) |

---

## 6. How the pieces connect (end-to-end)

1. **Superadmin** logs in → creates an **Admin** → grants `chatbot` / `voiceChatbot` / `manualQueryUpload` in the
   Activation section → can deactivate the Admin at any time.
2. **Admin** logs in → if `access.chatbot`: opens **Chatbot** module → picks **Product Chatbot** (select a Product) or
   **Overall Chatbot** → builds the question/option tree per language (English/Tamil) → saves via `PUT /flow`.
3. Admin clicks **Generate** → backend validates the tree → creates `slug` + `apiKey` + `publicLink` + QR code.
4. **Normal chatbot** (`mode:"normal"`) is meant to be rendered client-side by a widget built like
   **ramajeyam-chatbot**'s `Chatbot.jsx` (buttons/text, no TTS) — it fetches `GET /api/public/bots/:slug`.
5. **AI Voice Chatbot** (`mode:"voice"`, requires `access.voiceChatbot`) is rendered like **ManiMark**'s
   `Chatbot.jsx` (same tree, plus TTS reading each question aloud) — same public endpoint, different frontend engine.
6. Every customer interaction — normal, voice, or manually uploaded — lands in the **Query** collection and shows up
   in the Admin's **Queries** table (`GET /api/queries`), filterable by chatbot/source/status.

---

*Frontend (React + Vite, matching this backend's contracts) is the next deliverable.*
