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

The **Connect** button in the inbox starts Meta's Instagram OAuth flow. The app secret and access tokens never reach the browser: the server validates OAuth `state`, exchanges the code, and stores tokens in a signed HttpOnly session.

1. Create an app at [developers.facebook.com/apps](https://developers.facebook.com/apps) and add the **Instagram API with Instagram Login** product.
2. In the app's Instagram settings, add this exact **Valid OAuth Redirect URI**:
   `http://localhost:5175/api/instagram/callback`
3. Copy `.env.example` to `.env` and fill in `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` and `INSTAGRAM_REDIRECT_URI` (it must match step 2 exactly, including trailing path).
4. Run `npm run dev` and click **Connect**.

Requirements and limits:

- The connecting account must be an **Instagram Business or Creator account**; the server rejects personal accounts.
- Scopes requested: `instagram_business_basic`, `instagram_business_manage_messages`.
- The connection currently authorizes the account only — the inbox still shows demo messages. Reading/sending real DMs additionally requires Instagram messaging permissions, a webhook endpoint, and Meta App Review.
- Production needs `SESSION_SECRET` (≥32 random chars) and a public `INSTAGRAM_REDIRECT_URI` matching the Meta dashboard.

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
