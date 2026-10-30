# Muse — Chat Coach

React + TypeScript + Vite frontend with a small Node/Express server that hosts the app and handles **Instagram Login (OAuth)** securely.

## Run locally

```bash
npm install
npm run dev   # app + OAuth API at http://localhost:5175
```

Production:

```bash
npm run build
npm start      # requires SESSION_SECRET and INSTAGRAM_REDIRECT_URI
```

## Instagram Login setup

The **Connect** button starts Meta's OAuth dialog and the server does the whole exchange. App secrets and tokens never reach the browser: the server validates OAuth `state`, trades the code for a user token, resolves the Facebook Page and its `instagram_business_account`, and keeps the resulting **Page access token** in a signed HttpOnly session.

Flow:

1. `GET /api/instagram/login` → redirects to `https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth` with `instagram_basic, instagram_manage_messages, pages_show_list, pages_read_engagement`.
2. `GET /api/instagram/callback` → `oauth/access_token` → long-lived user token → `GET /me/accounts?fields=...,instagram_business_account{id,username}`.
3. `GET /api/instagram/conversations` → `GET /{ig-business-id}/conversations?platform=instagram` for the inbox list.
4. `GET /api/instagram/messages/:threadId` → last 20 messages of the selected thread.
5. `POST /api/instagram/send` → `POST /{ig-business-id}/messages` with `recipient.id`, only after the user approves the draft.

Configure in the [Meta app dashboard](https://developers.facebook.com/apps):

1. Add the **Facebook Login** product and, under **Instagram**, the **Instagram API with Instagram Login** messaging permissions.
2. Add this exact **Valid OAuth Redirect URI** (no trailing slash):
   `http://localhost:5175/api/instagram/callback` — and for production `https://<your-app-domain>/api/instagram/callback`.
3. Copy `.env.example` to `.env` and fill in `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI` (must match step 2 byte-for-byte).
4. Run `npm run dev` and click **Connect**.

Requirements and limits:

- The Instagram profile must be a **Business or Creator** account **linked to a Facebook Page** that you admin. The callback resolves the Page automatically; without one it returns `?instagram_error=no_instagram_account`.
- `instagram_manage_messages` must be approved for the app (App Review) before Meta will return real DM threads and allow sends. Until then the inbox loads but Meta rejects the conversation request — the UI surfaces Meta's message.
- Sends only work inside Instagram's 24-hour customer-message window.
- Optional tuning: `GRAPH_API_VERSION` (default `v21.0`) and `LLM_MODEL`.
- Production needs `SESSION_SECRET` (≥ 32 random chars) and a public `INSTAGRAM_REDIRECT_URI` matching the Meta dashboard.

Troubleshooting (`?instagram_error=` codes shown as a toast):

| code | meaning |
| --- | --- |
| `denied` | the user cancelled the dialog |
| `token_exchange_failed` | app id/secret or redirect URI mismatch |
| `pages_fetch_failed` | `pages_show_list` not granted |
| `no_pages` | no Facebook Page on that account |
| `no_instagram_account` | Page has no linked Instagram Business account |

---

# React + TypeScript + Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
