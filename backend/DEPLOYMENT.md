# Deployment Guide — Salon Management (Phase 1 prototype)

This guide deploys the three pieces so anyone can test from a browser:

```
[ Frontend (Vercel) ]  →  [ Backend API (Render) ]  →  [ PostgreSQL (Neon) ]
     static React            Node/Express server          managed Postgres
```

## Recommended stack (all free tier)

| Piece | Provider | Why |
| --- | --- | --- |
| Database | **Neon** | Free with no time limit, real Postgres, ~0.5 GB storage — plenty for a prototype. Scales to zero when idle. |
| Backend API | **Render** | Free Node web service. Runs a real always-available process (needed for SERIALIZABLE transactions + httpOnly Secure cookies). Note: sleeps after ~15 min idle; first request after that takes ~50s to wake. |
| Frontend | **Vercel** | Free static hosting for the built React app. |

**If Render's cold-start delay is a problem** (frequent testers, live demos): move only the
backend to **Railway** (~$5/month, no sleep). Neon + Vercel stay free and unchanged. The code
and environment variables are identical — only the backend host differs.

Why not serverless functions for the backend: this API keeps a long-lived Express process,
uses SERIALIZABLE Postgres transactions, and sets an httpOnly refresh cookie. A persistent
server (Render/Railway) fits that far better than short-lived serverless functions.

---

## Order of operations

Deploy bottom-up: **database first**, then backend (needs the DB URL), then frontend (needs the
backend URL), then wire CORS back to the frontend URL.

---

## 1. Database — Neon

1. Create a free account at neon.tech and create a project (choose a region near your testers).
2. Copy the connection string it gives you. It looks like:
   ```
   postgresql://<user>:<password>@<host>-pooler.<region>.neon.tech/<db>?sslmode=require
   ```
3. Neon needs **two** URLs for Prisma:
   - `DATABASE_URL` — the **pooled** string above (host contains `-pooler`). Used by the running app.
   - `DIRECT_URL` — the same string with `-pooler` **removed** from the host. Used for migrations.

   Prisma migrations don't work over the pooled connection, so both are required. Example:
   ```
   DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
   DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```

You do **not** run anything locally for this. The tables get created in step 2 (migration).

---

## 2. Backend — Render

### 2a. Push the repo to GitHub
Render deploys from a Git repo. Make sure `backend/` is committed and pushed.

### 2b. Create the web service
1. Render dashboard → **New → Web Service** → connect your GitHub repo.
2. Set **Root Directory** to `backend`.
3. Build command:
   ```
   npm install && npm run build && npx prisma migrate deploy --schema src/prisma/schema.prisma
   ```
4. Start command:
   ```
   npm start
   ```

> `prisma migrate deploy` applies existing migrations to the Neon database without prompting.
> Run the seed once separately (step 2d) if you want demo data.

### 2c. Environment variables
Set these in the Render service settings (Environment tab):

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | *(the Neon **pooled** string, host has `-pooler`)* | Include `?sslmode=require`. |
| `DIRECT_URL` | *(the Neon **direct** string, `-pooler` removed)* | Required for `prisma migrate deploy`. |
| `JWT_ACCESS_SECRET` | *(a long random string)* | Generate with `openssl rand -base64 48` or any password generator. |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | |
| `CORS_ORIGIN` | *(your Vercel URL, set in step 4)* | e.g. `https://salon-mgmt.vercel.app`. Fill in after the frontend is deployed. |
| `COOKIE_SECURE` | `true` | Required so the refresh cookie is sent over HTTPS. |
| `NODE_ENV` | `production` | |
| `PORT` | *(leave unset)* | Render provides `PORT` automatically; the app reads it. |

After it deploys, note the backend URL, e.g. `https://salon-api.onrender.com`.
Health check: visit `https://salon-api.onrender.com/health` → should return `{"status":"ok"}`.

### 2d. Seed demo data (optional, once)
From the Render service **Shell** tab (or locally with `DATABASE_URL` pointed at Neon):
```
npm run seed
```
This creates the demo salon and users (all passwords `password`):
- Super Admin — super@platform.example
- Owner — owner@glowandgo.example
- Manager — manager@glowandgo.example
- Receptionist — reception@glowandgo.example

---

## 3. Frontend — Vercel

1. Vercel dashboard → **New Project** → import the same GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite. Build command `npm run build`, output `dist` (Vercel usually detects this).
4. Environment variable:
   | Variable | Value |
   | --- | --- |
   | `VITE_API_BASE_URL` | `https://salon-api.onrender.com/api` *(your Render URL + `/api`)* |

   > The adapter swap is automatic: `frontend/src/core/api/client.ts` uses the real
   > `HttpApiClient` whenever `VITE_API_BASE_URL` is set, and falls back to the in-memory
   > mock when it is not. No code change is needed — just set the variable.
5. Deploy. Note the frontend URL, e.g. `https://salon-mgmt.vercel.app`.

---

## 4. Wire CORS back to the frontend

Return to Render → set `CORS_ORIGIN` to the exact Vercel URL from step 3, then redeploy the
backend. This lets the browser call the API with credentials (the refresh cookie).

---

## 5. Verify end-to-end

1. Open the Vercel frontend URL.
2. Log in as `owner@glowandgo.example` / `password`.
3. Confirm the dashboard, employees, availability, and a booking flow work.
4. (First request after idle on Render free tier may take ~50s while the service wakes — expected.)

Share the frontend URL with testers.

---

## Environment variable summary

**Backend (Render/Railway):**
```
DATABASE_URL=postgresql://...-pooler...neon.tech/...?sslmode=require
DIRECT_URL=postgresql://...neon.tech/...?sslmode=require
JWT_ACCESS_SECRET=<long-random-string>
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
CORS_ORIGIN=https://<your-frontend>.vercel.app
COOKIE_SECURE=true
NODE_ENV=production
```

**Frontend (Vercel):**
```
VITE_API_BASE_URL=https://<your-backend>.onrender.com/api
```

---

## Notes & gotchas

- **Local vs deployed data are separate databases.** Your laptop/dev data never mixes with the
  deployed Neon database. That's intended.
- **Cookie path:** the refresh cookie is scoped to `/api/auth`; the frontend's refresh call must
  hit that path (it does by default).
- **Render sleep:** free web services sleep after ~15 min idle. To keep it awake during a demo,
  ping `/health` periodically, or upgrade the backend to Railway (~$5/mo, no sleep).
- **Migrations on redeploy:** `prisma migrate deploy` is safe to run on every deploy — it only
  applies migrations that haven't run yet.
- **Secrets:** never commit real secrets. `.env` is gitignored; set values in each platform's
  dashboard.
