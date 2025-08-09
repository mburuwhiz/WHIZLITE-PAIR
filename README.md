---

# ✨ WHIZLITE — Multi-Device QR Linker

<p align="center">
  <!-- Inline SVG typing animation -->
  <svg width="760" height="140" viewBox="0 0 760 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <style>
      .bg { fill: #0f172a; }
      .title { font: 700 28px/1.1 "Inter", "Segoe UI", Roboto, sans-serif; fill: #fff; }
      .subtitle { font: 500 14px/1.2 "Inter", sans-serif; fill: #cbd5e1; }
      .cursor { fill: #60a5fa; animation: blink 1s steps(2, start) infinite; }
      .typing text { overflow: visible; }
      @keyframes blink { 50% { opacity: 0; } }
    </style>

```
<rect width="760" height="140" rx="12" class="bg"/>
<g transform="translate(28,34)" class="typing">
  <text class="title">WHIZLITE — Link WhatsApp sessions, instantly</text>
  <g transform="translate(0,44)">
    <text class="subtitle" id="typed">The cutest, fastest way to get your WhatsApp session ID — sent securely to your number.</text>
    <!-- cursor -->
    <rect x="620" y="-12" width="8" height="18" class="cursor" rx="2"/>
  </g>
</g>
```

  </svg>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img alt="Express" src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img alt="Socket.IO" src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" />
  <img alt="Baileys" src="https://img.shields.io/badge/Baileys-0ea5e9?style=for-the-badge" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
</p>

---

A tiny, secure web server that generates a WhatsApp login QR and delivers the resulting `WHIZLITE_<session_id>` to *your* phone — fast, lightweight, and multi-device ready.

---

## Key features

* Minimal, beautiful UI focused on one job: linking WhatsApp.
* Instant QR generation and real-time updates via **Socket.IO**.
* Session delivered directly to your phone (no external DB required).
* In-memory session store for privacy (cleared on restart).
* Built to handle multiple concurrent pairings.

---

## Quick start

1. Clone:

```bash
git clone https://github.com/mburuwhiz/whizlite-pair.git
cd whizlite-pair
```

2. Install:

```bash
npm install
```

3. Create `.env` (defaults shown):

```
PORT=3000
HOST=0.0.0.0
```

4. Start:

```bash
npm start
# or for dev with hot reload (if you add nodemon)
# npx nodemon ./src/index.js
```

Open `http://localhost:3000`, scan the QR (WhatsApp → Settings → Linked devices → Link a device) and you’ll get a message with your `WHIZLITE_` session ID.

---

## Files & structure (typical)

```
.
├─ src/
│  ├─ index.js        # server: express + socket.io + baileys integration
│  ├─ lib/            # helpers (qr generator, session manager)
│  └─ public/         # frontend (minimal UI + live QR)
├─ .env
├─ package.json
└─ README.md
```

---

## Security notes (read first)

* Sessions are held **only in memory** to minimize persistent risk. A restart clears them.
* Treat `WHIZLITE_` session tokens like secrets — rotate or invalidate when needed.
* If you expose the server to the internet, use HTTPS + authentication (reverse proxy, basic auth, or JWT).
* For production, add persistent encrypted storage and regeneration/expiry policies.

---

## Ideas / Next steps (WhatsApp automation & bots — forward-thinking)

WHIZ (this is for you 😉): if you want to evolve WHIZLITE into a WhatsApp automation platform, consider:

* Persisting sessions in an encrypted store (e.g., SQLite + AES) for controlled long-running bots.
* Add an admin UI for session lifecycle: revoke, refresh, export/import.
* Integrate a webhook/queue (Redis, RabbitMQ) so your automation workers receive messages reliably.
* Build pre-made automation templates: autoresponders, broadcast scheduler, CRM hooks.
* Add a secure OAuth / API key layer for third-party apps to programmatically request pairing links.
* Experiment with low-cost hosting (Fly.io, Railway, Render free tiers) for demos.

Free / practical tools to explore:

* Node.js — runtime for server apps (free).
* Baileys — lightweight WhatsApp Web client library (Node).
* qrcode or qr-image — generate QR data URLs.
* Redis (free tier/dev) — ephemeral session store/locking.
* ngrok or Cloudflare Tunnel — expose local server securely for testing.

---

## Example env / runtime tips

* Use `PORT` to change the listening port.
* When exposing publicly, put NGINX / Caddy in front to enable TLS and rate limiting.
* For CI builds, add a lint/test step and a small `integration` check that the server returns `200 /` and a valid QR payload.

---

## Contributing

PRs welcome. Keep changes focused and include tests for new features. If you add storage or long-lived sessions, document the security model clearly.

---

## Credits & references

* Project & design — **Josphat Mburu** ([@mburuwhiz](https://github.com/mburuwhiz)) — WHIZ.
* Libraries / docs worth reading:

  * Node.js — [https://nodejs.org/](https://nodejs.org/)
  * Express — [https://expressjs.com/](https://expressjs.com/)
  * Socket.IO — [https://socket.io/](https://socket.io/)
  * Baileys (WhatsApp Web library) — [https://github.com/adiwajshing/Baileys](https://github.com/adiwajshing/Baileys)
  * Shields.io (badges) — [https://shields.io/](https://shields.io/)
  * QR generation (example libs): `qrcode` (npm) — [https://www.npmjs.com/package/qrcode](https://www.npmjs.com/package/qrcode)

---

## License

MIT © WHIZ (Josphat Mburu). See `LICENSE` for details.

---

