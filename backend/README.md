# Salon Management — Backend (Phase 1)

Node + TypeScript + Express + Prisma + PostgreSQL. Implements the frozen frontend
`ApiClient` contract over HTTP (see `.kiro/specs/salon-management-phase-1/backend-implementation-design.md`).

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (via Docker or a local/hosted instance)

## Local run

```bash
# 1. Start Postgres (from the repo root)
docker compose up -d

# 2. Configure env
cd backend
cp .env.example .env        # adjust DATABASE_URL / secrets if needed

# 3. Install + generate client
npm install
npm run prisma:generate -- --schema src/prisma/schema.prisma

# 4. Create the database schema
npx prisma migrate dev --schema src/prisma/schema.prisma --name init

# 5. Seed demo data (mirrors the frontend mock)
npm run seed

# 6. Run the API
npm run dev                 # http://localhost:4000/api  (docs at /api/docs)
```

> The Prisma schema lives at `src/prisma/schema.prisma` (not the default location),
> so every `prisma` CLI command needs `--schema src/prisma/schema.prisma`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the API with hot reload |
| `npm run build` | Type-check + compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm run seed` | Seed demo data |
| `npm test` | Run Jest unit tests |
| `npm run typecheck` | Type-check only |
| `npm run lint` | ESLint |

## Frontend integration

Set `VITE_API_BASE_URL=http://localhost:4000/api` in `frontend/.env` and switch the
adapter in `frontend/src/core/api/client.ts` to the HTTP client to use this backend.

## Demo credentials (after `npm run seed`)

All passwords are `password`.

| Role | Email |
| --- | --- |
| Super Admin | super@platform.example |
| Owner | owner@glowandgo.example |
| Manager | manager@glowandgo.example |
| Receptionist | reception@glowandgo.example |

## Verification status

- `npm run build` — passes (full type-check across all modules).
- `npm test` — passes (16 tests: interval math + availability engine incl. tz round-trip).
- Live DB migration, seed, and HTTP integration tests require a running Postgres and
  have **not** been executed in the build environment (no Docker/Postgres available there).
  Run the steps above locally to exercise them.
