# Muse / SoulSync — Chat Coach

React + TypeScript + Vite frontend with a small Node/Express server that hosts the app and does the WhatsApp work **server-side**.

The user links their own WhatsApp by scanning a QR code — the same "Linked devices" flow as WhatsApp Web — and then picks **which chats to import**. Only the chats they tick are readable by the app, and only for the lifetime of the session.

## Run locally

```bash
npm install
npm run dev   # app at http://localhost:5175
```

Production:

```bash
npm run build
npm start     # requires SESSION_SECRET
```

## How the WhatsApp login works

1. The person ticks the two consent boxes (18+ and Terms) in the inbox panel, then presses **Connect**.
2. `POST /api/whatsapp/connect` starts a Baileys socket and the server renders a pairing QR code.
3. They open **WhatsApp → Settings → Linked devices → Link a device** and scan it. The app polls `/api/whatsapp/status` and closes the QR modal as soon as the socket reports `open`.
4. The chat picker lists their chats; they tick the ones to import and press **Import selected**.
5. `POST /api/whatsapp/import` marks those chats as selected and pulls up to 50 messages each for chats that arrived without messages.

Flow of the endpoints:

| endpoint | purpose |
| --- | --- |
| `GET /api/whatsapp/status` | connection state, QR image, linked account, chat/import counts |
| `POST /api/whatsapp/connect` | start the socket and produce a QR |
| `GET /api/whatsapp/chats` | chats visible to the linked device (for the picker) |
| `POST /api/whatsapp/import` | `{ chatIds: string[] }` — up to 25 chats |
| `GET /api/whatsapp/messages/:chatId` | imported chat's messages |
| `POST /api/whatsapp/send` | send a reply, only for an imported chat |
| `POST /api/whatsapp/disconnect` | log out and drop everything |
| `POST /api/whatsapp/cleanup` | clear imported chat bodies, keep the link |

Optional environment variables:

- `SESSION_SECRET` — required in production, at least 32 random characters.
- `GEMINI_API_KEY` or `OPENAI_API_KEY` — enables real AI analysis in `/api/analyze-chat`. Without one, the route returns a simple heuristic analysis.
- `PORT` — defaults to `5175`.

## Important limits

- **This is not the official WhatsApp Business API.** It uses the unofficial Baileys linked-device protocol, which is against WhatsApp's Terms of Service. A connected number can be rate limited or banned. Only use it with a number you control and accept that risk.
- **No data is written to disk.** Signal credentials, the chat index and every message body live in server memory only, attached to the signed session cookie. Restarting the server, pressing Disconnect, or End Chat drops them. There is no database and no recovery.
- **One linked device per server session.** Connecting again replaces the previous socket.
- **Chat list is bounded by what WhatsApp syncs.** A fresh linked device receives recent chats; groups and very old threads may need a reload before they appear. `syncFullHistory` is deliberately off — with it on, WhatsApp closes the socket (status 428) before issuing a QR code.
- **Sends are exactly what the account could send by hand.** No bulk messaging; the UI only sends after explicit approval.
- The app has **no user accounts**. The "login" is the WhatsApp link itself; the only thing stored is an anonymous signed session cookie.

## Frontend notes

Vite + React 19 + Tailwind. `src/App.tsx` holds the inbox, chat panel, AI coach, the QR modal and the selective-import picker. `src/App.css` holds all styling, including the modal styles (`.wa-modal*`).

Demo chats are shown until a WhatsApp account is linked, so the interface is usable without a phone.
