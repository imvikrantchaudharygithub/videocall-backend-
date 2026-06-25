# Deploying the CompanionCall backend

This is a long-running **Express + Socket.io** server (real-time call signaling,
a `setInterval` billing engine, and Redis presence). It must run on a **persistent
host**, NOT a serverless platform.

- ❌ **Vercel / Netlify** — serverless. Socket.io can't hold WebSocket connections
  and `setInterval` doesn't survive. Calls will not ring. Do not use.
- ✅ **Render** (free), **Railway**, **Fly.io**, **DigitalOcean App Platform/Droplet** — all run a persistent process.

## Recommended free stack
- **Backend** → Render (free web service)
- **MongoDB** → MongoDB Atlas M0 (free) — in Atlas → Network Access → allow `0.0.0.0/0`
- **Redis** → Upstash (free) — create a Redis DB, copy the `rediss://` URL
- **Agora** → already cloud

## Deploy on Render (free)
1. Push this repo to GitHub (done).
2. Render Dashboard → **New → Blueprint** → pick this repo (it reads `render.yaml`).
3. Set the secret env vars when prompted:
   - `SECRET_KEY`, `SESSION_SECRET` — any random strings
   - `MONGODB_URI` — your Atlas SRV string
   - `REDIS_URL` — your Upstash URL
   - `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` — your Agora values
   - (`NODE_ENV` is preset to `development` so OTP codes appear in **Render → Logs** — no Twilio needed for testing.)
4. Deploy. Your public URL will be `https://companioncall-backend.onrender.com` (or similar).
5. Seed data once (Render Shell, or run locally against the Atlas URI):
   `npm run seed` then `npx ts-node ./src/scripts/seedTestCall.ts`

## After deploy
Give the URL to update the apps:
- `caller-app/src/utils/constants.ts` and `host-app/src/utils/constants.ts`
  → `API_BASE_URL = https://<url>/api`, `SOCKET_URL = https://<url>`
Then rebuild the APKs. Calls will then work for users on **any** internet connection.

## Notes
- Render free tier **spins down after ~15 min idle** (first request after = ~50s cold start). Fine for testing; upgrade for production.
- The app reads `PORT` from the environment (Render injects it) — never hardcode it.
- CORS is already `*` for both Express and Socket.io, so native apps connect fine.
- For login during testing: trigger OTP in the app, then read the code from **Render → Logs** (`[DEV] OTP for <phone>: <code>`).
