# Quantora AI

Quantora AI is a crypto market intelligence platform with live market tracking, AI signal generation, portfolio review, alerting, and expert-style chat.

It is built as a full-stack SaaS-style app:

- React + Vite frontend
- Express + MongoDB backend
- Binance/CoinGecko/CoinPaprika/CoinCap market provider fallback
- Quantora deterministic signal engine with optional AI provider support
- Email, browser push, and in-app notification flows
- Portfolio planning with risk review, stop zones, and forecast ranges

> This platform provides AI-generated market insights and not financial advice.

## Project Structure

```text
QuantoraAI/
  client/                 React, Vite, Tailwind, Clerk
  server/                 Express API, MongoDB, market services, AI signals
  README.md
```

## Core Features

- Live market dashboard with market cap, volume, BTC dominance, movers, and coin table
- Coin detail pages with live price, chart tooltip values, signal reasoning, confidence chart, and signal history
- Portfolio intelligence for planned buys and already-bought positions
- AI Buy / Sell Plan with defensive language and review zones, not automatic trade orders
- AI Expert chat with account and portfolio context
- Notifications page with email routing, page popups, browser push, DND, and per-coin email selection
- Multi-currency display
- Safe provider fallback and stale-cache protection

## Local Setup

### 1. Install Backend

```bash
cd server
npm install
```

### 2. Install Frontend

```bash
cd client
npm install
```

### 3. Create Env Files

Use the tracked dummy/example files as references. Do not commit real secrets.

```bash
cp server/.env.example server/.env.local
cp client/.env.example client/.env.local
```

On Windows PowerShell:

```powershell
Copy-Item server\.env.example server\.env.local
Copy-Item client\.env.example client\.env.local
```

Fill in MongoDB, Clerk, SMTP, and optional AI provider keys.

### 4. Run Backend

```bash
cd server
npm run dev
```

Backend runs on:

```text
http://localhost:5000
```

Health check:

```bash
curl http://localhost:5000/api/health
```

### 5. Run Frontend

```bash
cd client
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

## Environment Files

Tracked safe placeholders:

- `.env.dummy`
- `server/.env.example`
- `server/.env.dummy`
- `client/.env.example`
- `client/.env.dummy`

Ignored real files:

- `.env`
- `.env.local`
- `server/.env`
- `server/.env.local`
- `client/.env`
- `client/.env.local`

## Backend Env Reference

```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGO_URI=your_mongodb_uri
MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1

AI_PROVIDER=auto
GEMINI_API_KEY=your_google_ai_key
GROQ_API_KEY=optional_groq_key
GROQ_MODEL=llama-3.1-8b-instant

SMTP_USER=your_gmail_address
SMTP_PASS=your_gmail_app_password

CLERK_FRONTEND_API=your_clerk_publishable_key
CLERK_API_KEY=your_clerk_secret_key

COINGECKO_API=https://api.coingecko.com
USE_COINGECKO_PRIMARY=true
MARKET_DATA_CACHE_SECONDS=2
AI_SIGNAL_CACHE_SECONDS=2

COINS=bitcoin,ethereum,binancecoin,solana,ripple,dogecoin,cardano,tron
```

## Frontend Env Reference

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

## Useful Commands

Backend:

```bash
cd server
npm run dev
npm run start
```

Frontend:

```bash
cd client
npm run dev
npm run lint
npm run build
```

## API Smoke Tests

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/markets
curl http://localhost:5000/api/snapshot/bitcoin
curl http://localhost:5000/api/predict/bitcoin
```

## Notes

- Real secrets must stay out of Git.
- Gmail email delivery requires a Gmail App Password, not the normal Gmail password.
- Browser push requires localhost or HTTPS and browser permission.
- Portfolio data is keyed to the signed-in account email so saved positions persist across logout/login.
- Market values update through live polling and provider fallback. If providers are slow, cached market rows protect the UI from blank states.
