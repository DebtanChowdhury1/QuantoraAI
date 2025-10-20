# Quantora AI

<!--
Quickstart snippets for local developers:
1. Configure environment:
   cp server/.env.example server/.env.local
   cp client/.env.example client/.env.local
   (Update MongoDB, Gemini, SMTP, and frontend base URLs as needed.)
2. Start backend + cron worker:
   cd server
   npm run dev
   (The cron scheduler boots automatically with the development server.)
3. Smoke-test the API:
   curl http://localhost:5000/api/markets/bitcoin
   curl http://localhost:5000/api/predict/bitcoin/history?limit=10
   curl -X POST http://localhost:5000/api/predict/bitcoin/refresh
-->


“Quantora AI — Predict Smarter. Spend Nothing.”

Quantora AI is a zero-cost, production-ready cryptocurrency prediction and alert platform. It blends CoinGecko market data, Google Gemini 2.0 Flash AI signals, secure email notifications, and a gated Clerk-authenticated frontend. The entire stack is built to operate 24/7 within free-tier limits.

## Architecture

```
QuantoraAI/
├── client/                 # React (Vite) + Tailwind + Clerk UI
│   ├── src/components/     # Navbar, CoinTable, ChartCard, AIInsight, etc.
│   ├── src/pages/          # Dashboard, CoinDetail, Alerts, Profile
│   └── src/lib/            # Axios client + data hooks
└── server/                 # Node.js + Express + Mongoose + Cron jobs
    ├── routes/             # REST API endpoints
    ├── services/           # CoinGecko, Gemini, mail, cron orchestration
    ├── models/             # User, Prediction schemas
    └── utils/              # Logging, limits, cache, errors
```

### Backend Highlights

- Express API with Helmet, CORS (locked to configured frontend origin), and rate limiting (30 req/min).
- CoinGecko integration with in-memory caching (5 min markets, 15 min charts) enforcing ≤250 requests/day.
- Gemini 2.0 Flash prompt templating with strict JSON schema validation (Zod) and ≤800 requests/day guard.
- Nodemailer (Gmail SMTP) dispatch with global ≤100 emails/day and per-user ≥60 min cooldown.
- Node-cron background loop (default 10 min) rotating ≤5 coins, diffing AI signals, and dispatching alerts only when action changes.
- Nightly (02:15 UTC) maintenance rolls raw predictions into hourly summaries and removes data older than 90 days.
- MongoDB Atlas models sized for free-tier (<0.5 GB) with indices on coin/action timestamps.

### Frontend Highlights

- Vite + React + Tailwind CSS dark theme (bg `#0e1116`, accent `#00ff88`, gold `#ffb800`).
- Clerk authentication (free plan) gating alert controls and profile management.
- React Query data layer with optimistic alert toggles and stale-time caching.
- Dashboard table with live CoinGecko markets + latest AI signals, weekly accuracy widget, and alert toggles.
- Coin detail view with Chart.js line chart, AI reasoning, historical signals, and alert preference controls.
- Alerts center summarizing dispatched emails and per-coin preferences, all animated with Framer Motion.

## Prerequisites

- Node.js ≥ 18.18.0 (required for native fetch & ESM support)
- npm ≥ 9.x
- MongoDB Atlas M0 cluster
- Google Gemini API key (Generative Language API)
- Gmail account with App Password (SMTP)
- CoinGecko public API access (no key required)
- Clerk publishable & secret keys (free tier)
- Optional: Cloudinary cloud (if media uploads are enabled)

## Environment Variables

### Backend (`server/.env`)

```
GEMINI_API_KEY=your_google_ai_key
MONGO_URI=your_atlas_connection_string
SMTP_USER=your_gmail_address
SMTP_PASS=your_gmail_app_password
CLERK_FRONTEND_API=your_clerk_publishable_key
CLERK_API_KEY=your_clerk_secret_key
CLOUDINARY_NAME=optional_cloudinary_name
CLOUDINARY_API_KEY=optional_cloudinary_key
CLOUDINARY_API_SECRET=optional_cloudinary_secret
CLIENT_ORIGIN=http://localhost:5173
PORT=5000
COINGECKO_API=https://api.coingecko.com
COINS=bitcoin,ethereum,solana,dogecoin,cardano
MARKETS_REFRESH_MIN=5
PREDICT_REFRESH_MIN=10
PREDICT_COINS_PER_CYCLE=5
MAX_GEMINI_REQ_PER_DAY=800
MAX_COINGECKO_REQ_PER_DAY=250
EMAIL_MAX_PER_DAY=100
EMAIL_MIN_GAP_MIN=60
SEND_EMAIL_ON_CHANGE_ONLY=true
RAW_PREDICTION_RETENTION_DAYS=90
ROLLUP_INTERVAL_HOURS=1
ENABLE_CLOUDINARY=false
```

### Frontend (`client/.env`)

```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_BASE_URL=http://localhost:5000/api
```

> The Clerk secret key stays on the server (.env); only the publishable key is exposed to the client.

## Local Development

1. **Install dependencies**
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
2. **Configure env files**
   - Copy `server/.env.example` → `server/.env` and populate values.
   - Create `client/.env` with the keys shown above.
3. **Run backend**
   ```bash
   cd server
   npm run dev
   ```
   The API is exposed at `http://localhost:5000`.
4. **Run frontend**
   ```bash
   cd client
   npm run dev
   ```
   Access the app at `http://localhost:5173`.
5. **Optional testing**
   - `curl http://localhost:5000/api/health` to verify the API.
   - Visit `http://localhost:5173` and sign in with Clerk to enable alerts.

## Deployment (Render + Clerk + cron-job.org)

### Backend on Render (Free Web Service)

1. Connect the repo to Render and create a **Web Service** (`Node`).
2. Build command: `cd server && npm install && npm run build` (build script not required — service uses `npm run start`).
3. Start command: `cd server && npm run start`.
4. Set environment variables from `.env` (Render → Environment → Add).
5. Scale to free tier (512 MB / 0.1 CPU) – keep runtime under 750 hours/month by using the free service (Render automatically pauses on inactivity).

> Render free tier sleeps after 15 minutes without requests. Use cron-job.org to keep critical endpoints warm during market hours if needed.

### Frontend on Render Static Site

1. Create a **Static Site** pointing to `/client`.
2. Build command: `npm install && npm run build`.
3. Publish directory: `dist`.
4. Environment variables: set `VITE_API_BASE_URL` to the Render backend URL.

### Clerk

1. Create a Clerk application (free tier up to 10,000 MAU).
2. Add your frontend URL (Render) and local dev URLs to authorized origins.
3. Copy the publishable key to `client/.env` and the secret key to `server/.env`.
4. Configure email templates as desired.

### Gmail SMTP

1. Enable 2FA on the Gmail account and create an **App Password** (16 characters).
2. Set `SMTP_USER` to the Gmail address and `SMTP_PASS` to the app password.
3. Gmail free tier allows up to 500 emails/day; we enforce ≤100 in code for extra safety.

### cron-job.org Scheduler

1. Create a heartbeat job hitting `https://your-render-app.onrender.com/api/predict/<coin>` at least once each morning to prewarm caches.
2. Optional: a `/api/health` ping every 10 minutes during trading sessions keeps Render awake.

## Operational Notes

- **Daily counters** reset automatically at UTC midnight; hitting limits yields 429 errors logged via Pino.
- **Market data provider: CoinGecko free public endpoints (no API key required). Monitor their status page for rate-limit updates.
- **Mongo storage**: raw predictions are pruned after 90 days, and hourly rollups compress usage.
- **Email alerts**: users receive notifications only when AI action changes (BUY/HOLD/SELL) and their 60‑minute cooldown has passed.
- **Security**: `.env` is ignored by Git, all API errors are sanitized, and incoming requests are rate limited.
- **Cloudinary**: toggle `ENABLE_CLOUDINARY=true` to integrate media uploads (hooks ready for extension).

## Future Enhancements

- Add WebSocket streaming for live updates without polling.
- Introduce portfolio tracking and personalized performance metrics.
- Expand scheduler window controls to dynamically skip quiet periods.

Enjoy running Quantora AI entirely on free-tier infrastructure. 🚀


#   Q u a n t o r a A I  
 