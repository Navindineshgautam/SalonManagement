# Backend Implementation Design — Salon Management SaaS (Phase 1)

Status: **Draft for review.** No backend code is written until this is approved.

This document specifies the backend that fulfills the **frozen frontend contract**
(`frontend/src/core/api/ApiClient.ts` + `types.ts`). The frontend currently runs against an
in-memory mock implementing that contract; the backend implements the same contract over
HTTP so the frontend swaps its adapter with a one-line change.

Grounded in: `requirements.md`, `design.md`, and the frozen contract.

---

## Overview

This backend implements the frozen frontend `ApiClient` contract over HTTP. Every method
becomes a REST endpoint with identical request/response shapes so the frontend can swap its
in-memory mock for the real API with a one-line adapter change. The server is the authoritative
enforcer of authentication, tenant isolation, role-based authorization, availability computation,
and concurrency-safe booking creation. Its observable behavior (status codes, dedupe, conflict
handling) matches the mock exactly.

### Goals & non-goals

**Goals**
- Implement every `ApiClient` method as a REST endpoint with identical request/response shapes.
- Enforce authentication, tenant isolation, and role-based authorization authoritatively on the server.
- Compute availability and create bookings with concurrency safety.
- Match the mock's observable behavior (status codes, dedupe, conflict handling) so the UI needs no changes.

**Non-goals (Phase 1, per HLD §18)**
- Rescheduling, cancellation, notifications, payments, invoices, inventory, subscriptions, audit logs, caching/queues.

---

## Architecture

The backend is a modular monolith: a single deployable Express application composed of
per-domain modules that share a Prisma-backed PostgreSQL database. Each module follows the same
layering (`routes → controller → service → prisma`), and all salon-scoped data access flows
through a `tenantScoped(prisma, salonId)` helper so tenant isolation is enforced structurally
rather than per-query. The subsections below cover the technology choices and the physical
project layout.

### Technology stack

| Concern | Choice |
| --- | --- |
| Runtime | Node.js 20 LTS + TypeScript |
| Framework | Express.js |
| ORM / DB | Prisma + PostgreSQL |
| Auth | JWT access token + opaque refresh token (httpOnly cookie) |
| Validation | zod |
| Docs | OpenAPI/Swagger at `/api/docs` |
| Testing | Jest + Supertest |
| Local DB | docker-compose (Postgres) |

Rationale: matches the stack already chosen in `design.md`, and Prisma gives type-safe,
tenant-scoped queries that mirror the frontend types closely.

---

### Project structure (modular monolith)

```
backend/
  src/
    server.ts                 # bootstrap
    app.ts                    # express assembly, middleware, route mounting
    config/                   # env, constants (SLOT_MINUTES=15, DAY window 360..1440)
    prisma/
      schema.prisma
      seed.ts                 # mirrors the frontend mock seed
    core/
      auth/                   # hashing, jwt, refresh-token service
      middleware/             # authenticate, tenantContext, authorize, validate, errorHandler
      http/                   # typed errors, response helpers
      db/                     # prisma client, tenantScoped() helper
      openapi/
    modules/
      auth/         (login, refresh, logout, me)
      platform/     (salons: create/list — SUPER_ADMIN)
      salon/        (get/update settings + users CRUD)
      services/
      employees/    (CRUD + leave + overrides)
      holidays/
      customers/
      availability/ (slot engine)
      bookings/     (create + list + get)
    shared/
      time/         # interval math + tz helpers (ported from frontend utils)
    tests/
```

Each module: `routes.ts → controller.ts → service.ts → prisma`. All salon-scoped DB access
goes through `tenantScoped(prisma, salonId)`.

---

## Data Models

### Data model (Prisma → PostgreSQL)

Instants stored as `timestamptz` (UTC). Schedule times stored as integer minutes-from-midnight
in the salon-local day. Calendar dates (leave/holiday/override) stored as `date`.

```
Salon(id, name, timezone, contactPhone?, contactEmail?, status, createdAt)
User(id, salonId? , email UNIQUE, passwordHash, role, name, status, createdAt)
RefreshToken(id, userId, tokenHash, expiresAt, revokedAt?, createdAt)
Service(id, salonId, name, durationMinutes, price Decimal, status)
Employee(id, salonId, name, phone, email, role, specialization, weeklyOff?, status, createdAt)
EmployeeService(employeeId, serviceId)                      -- composite PK (skills)
WorkingHour(id, employeeId, weekday, startMinute, endMinute)
Break(id, employeeId, weekday, startMinute, endMinute)
Leave(id, employeeId, startDate, endDate)
ScheduleOverride(id, employeeId, date, type, startMinute?, endMinute?)
Holiday(id, salonId, date, name)
Customer(id, salonId, name, phone, email?, createdAt)       -- UNIQUE(salonId, phone)
Booking(id, salonId, customerId, startAt, endAt, status, createdBy, createdAt)
BookingItem(id, bookingId, serviceId, employeeId, startAt, endAt)
```

**Indexes / constraints**
- `User.email` unique; `Customer(salonId, phone)` unique; `Holiday(salonId, date)` unique.
- `salonId` index on every salon-scoped table.
- `BookingItem(employeeId, startAt, endAt)` for conflict detection.

**Enums**: `Role = SUPER_ADMIN|OWNER|MANAGER|RECEPTIONIST`, `EntityStatus = ACTIVE|INACTIVE`,
`ScheduleOverrideType = EXTRA_HOURS|TIME_OFF`, `BookingStatus = BOOKED`.

---

## Components and Interfaces

The public interface is the REST surface below, which maps one-to-one to the frozen `ApiClient`
contract. The supporting components — authentication, tenant context, and authorization
middleware — are described in the subsection after the endpoint map.

### Endpoint map (contract → REST)

Base `/api`. Every response matches the frozen TS types exactly.

| ApiClient method | Method + path | Roles | Notes |
| --- | --- | --- | --- |
| login | POST /auth/login | public | sets refresh cookie, returns `{accessToken,user}` |
| refresh | POST /auth/refresh | cookie | rotates refresh, returns `{accessToken}` |
| logout | POST /auth/logout | any | revokes refresh |
| me | GET /auth/me | any | returns AuthUser |
| createSalon | POST /platform/salons | SUPER_ADMIN | salon + initial owner |
| listSalons | GET /platform/salons | SUPER_ADMIN | |
| getSalon | GET /salon | salon roles | |
| updateSalon | PUT /salon | OWNER | timezone validated |
| listSalonUsers | GET /salon/users | OWNER, MANAGER | |
| createSalonUser | POST /salon/users | OWNER, MANAGER* | *Manager → RECEPTIONIST only |
| updateSalonUser | PATCH /salon/users/:id | OWNER, MANAGER* | |
| deleteSalonUser | DELETE /salon/users/:id | OWNER | cannot delete owner |
| listServices | GET /services | salon roles | |
| createService | POST /services | OWNER, MANAGER | duration % 15 == 0 |
| updateService | PUT /services/:id | OWNER, MANAGER | |
| deleteService | DELETE /services/:id | OWNER, MANAGER | |
| listEmployees | GET /employees | salon roles | |
| getEmployee | GET /employees/:id | salon roles | |
| createEmployee | POST /employees | OWNER, MANAGER | |
| updateEmployee | PUT /employees/:id | OWNER, MANAGER | |
| deleteEmployee | DELETE /employees/:id | OWNER, MANAGER | |
| addEmployeeLeave | POST /employees/:id/leave | OWNER, MANAGER | |
| removeEmployeeLeave | DELETE /employees/:id/leave/:leaveId | OWNER, MANAGER | |
| addEmployeeOverride | POST /employees/:id/overrides | OWNER, MANAGER | |
| removeEmployeeOverride | DELETE /employees/:id/overrides/:overrideId | OWNER, MANAGER | |
| listHolidays | GET /holidays | salon roles | |
| createHoliday | POST /holidays | OWNER, MANAGER | `(salonId, date)` unique; not yet in UI |
| deleteHoliday | DELETE /holidays/:id | OWNER, MANAGER | not yet in UI |
| searchCustomers | GET /customers?search= | salon roles | |
| createCustomer | POST /customers | salon roles | dedupe by (salonId, phone) |
| getAvailability | GET /availability?date=&serviceIds=&employeeId= | salon roles | |
| createBooking | POST /bookings | salon roles | concurrency-safe |
| listBookings | GET /bookings?from=&to=&employeeId= | salon roles | |
| getBooking | GET /bookings/:id | salon roles | |

"salon roles" = OWNER, MANAGER, RECEPTIONIST. Receptionist is read-only on services/employees
(covered by the role column above).

`createHoliday`/`deleteHoliday` are additions beyond the frozen `ApiClient` contract: the
backend exposes them now (holidays already affect availability), and the frontend will add the
corresponding `ApiClient` methods and UI in a later phase. All other endpoints map one-to-one to
the current contract.

---

### Auth, tenant context, authorization

- **Password**: bcrypt (cost ≥ 12). Plaintext never stored.
- **Access token**: JWT (~15 min), payload `{ sub, role, salonId }`, HS256. Frontend keeps it in memory.
- **Refresh token**: random opaque value, stored hashed, delivered as `httpOnly; Secure; SameSite` cookie; rotated on refresh; revoked on logout.
- **authenticate** → verifies access token, attaches principal.
- **tenantContext** → derives `salonId` from the token only (never from body/query). SUPER_ADMIN has `salonId=null`.
- **authorize(...roles)** + a permission map for the read-only cases.
- **Cross-tenant** references resolve to **404** (never reveal existence), matching the mock.

Login must not reveal whether an email exists (generic 401), matching the mock.

---

## Correctness Properties

The properties below carry the system's core correctness guarantees and must hold under
concurrency and across the client/server boundary:

**Property 1: Availability agreement.** The server computes slots with the same pure interval
math the frontend uses, so client-predicted availability and server-authoritative availability
agree for the same inputs.

**Property 2: No double-booking.** No two bookings for the same professional may hold
overlapping intervals; concurrent create requests for the same slot resolve to exactly one
success.

**Property 3: Atomicity.** A booking either persists fully (`Booking` + all `BookingItem`s) or
not at all; a conflict persists nothing.

**Property 4: Tenant isolation.** No request can read or mutate data outside its token-derived
`salonId`; cross-tenant references are indistinguishable from non-existent ones (404).

### Availability engine

Ports the frontend's pure interval math (`intervals.ts`) and tz helpers (`datetime.ts`) so the
server and client agree exactly.

For a professional + date + total service duration:
1. Base = working hours for weekday ∩ [06:00, 24:00].
2. Apply overrides: `EXTRA_HOURS` adds, `TIME_OFF` subtracts (full-day TIME_OFF ⇒ no slots).
3. If weekday == weeklyOff, or date ∈ any Leave, or a Holiday exists ⇒ no slots.
4. Subtract breaks and existing bookings (converted from UTC to salon-local minutes).
5. Emit 15-min-aligned starts where `start + totalDuration ≤ interval end`.
6. Convert starts to UTC ISO instants.

Only professionals whose skills cover **all** requested services are considered.

`GET /availability` returns `ProfessionalAvailability[]` (employeeId, employeeName, slots[]),
identical to the mock.

---

### Concurrency-safe booking creation

`POST /bookings` runs in a **SERIALIZABLE** transaction:

1. Resolve or create the customer within the salon (dedupe by `(salonId, phone)`).
2. Compute each item's `[startAt, endAt)`: services on the **same** professional are sequential;
   different professionals run in **parallel**. Booking span = earliest start .. latest end.
3. Validate each item against the professional's schedule (hours/breaks/off/leave/holiday/overrides).
4. Check overlap against existing `BookingItem`s for the same professional
   (`existing.startAt < new.endAt AND existing.endAt > new.startAt`).
5. If any conflict ⇒ abort, persist nothing, return **409**.
6. Insert `Booking` + `BookingItem`s; commit. On serialization failure, retry (bounded), else 409.

This matches the mock's create semantics and the design.md guarantees. The `(employeeId,
startAt, endAt)` index plus SERIALIZABLE prevents two concurrent bookings from both committing.

---

## Error Handling

### Error contract

Central error handler emits the frozen shape:

```json
{ "error": { "code": "CONFLICT", "message": "...", "details": [{ "field": "...", "message": "..." }] } }
```

Codes → status: VALIDATION 400, UNAUTHENTICATED 401, FORBIDDEN 403, NOT_FOUND 404,
CONFLICT 409, SERVER_ERROR 500. zod validation failures map to VALIDATION with field details.

Note: the frontend's `ApiError` currently carries `status`; the HTTP client adapter will map
the HTTP status into that field, so the contract type is preserved.

---

## 10. Migration & seed

- Prisma migration creates all tables/enums/indexes.
- `seed.ts` mirrors the frontend mock seed: one SUPER_ADMIN, "Glow & Go Salon" (Asia/Kolkata),
  owner/manager/receptionist (password `password`), 3 employees with skills+schedules,
  6 services, 2 customers. This keeps demo parity between mock and real backend.

---

## 11. Frontend integration (the swap)

- Add `HttpApiClient implements ApiClient` in `frontend/src/core/api/http/` using `fetch`/axios:
  - Attaches the in-memory access token; on 401 calls `/auth/refresh` (cookie) once and retries.
  - Maps HTTP error envelope → `ApiClientError`.
- `frontend/src/core/api/client.ts` switches `api` to the HTTP client via an env flag
  (`VITE_API_BASE_URL`), defaulting to mock when unset. **One-line swap.**
- CORS on the API allows the frontend origin with credentials.

---

## Testing Strategy

### Test coverage (Jest + Supertest)

- **Unit**: interval math, availability engine (breaks/off/leave/holiday/overrides/duration-fit/tz).
- **Auth**: login success/failure (no enumeration), refresh rotation, logout revocation, 401 without token.
- **Tenant isolation**: salon A cannot read/mutate salon B ⇒ 404.
- **Authorization**: role matrix (403 where denied), Manager-can't-touch-owner/settings.
- **Customers**: dedupe by phone.
- **Bookings**: happy path, conflict ⇒ 409 (nothing persisted), concurrent requests ⇒ exactly one succeeds.

---

## 13. Local run

```
docker compose up -d           # postgres
cd backend
cp .env.example .env           # DB URL, JWT secrets, cookie + CORS settings
npm install
npx prisma migrate dev
npm run seed
npm run dev                    # API on http://localhost:4000
```

Frontend: set `VITE_API_BASE_URL=http://localhost:4000/api` in `frontend/.env` to use the real backend.

---

## 14. Proposed build order (for the implementation PRs)

1. Backend scaffold + docker-compose + env + health check.
2. Prisma schema + migration + seed.
3. Core middleware (errors, validation, auth, tenant, authorize) + tests.
4. Auth module (login/refresh/logout/me) + tests.
5. Platform (salons) + salon settings/users + tests.
6. Services + Employees (+ leave/overrides) + Holidays (list/create/delete) + tests.
7. Customers + Availability engine + tests.
8. Bookings (create/list/get, concurrency-safe) + tests.
9. OpenAPI docs + HttpApiClient in frontend + end-to-end smoke.

---

## 15. Resolved decisions

These were open questions during review; the reviewer's answers are now settled and reflected
throughout this document.

1. **API port / base path**: `http://localhost:4000/api`. Confirmed.
2. **JWT lifetimes**: access token 15 min, refresh token 7 days. Confirmed.
3. **Holidays**: add `createHoliday`/`deleteHoliday` now (holidays already affect availability).
   These go beyond the frozen `ApiClient` contract; the frontend will add matching methods and UI
   in a later phase. See the endpoint map and §11.
4. **Seed parity**: keep demo data identical to the frontend mock seed. Confirmed.
5. **PR strategy**: ship as a single backend PR (the §14 build order is the commit sequence
   within that PR, not separate PRs).
