# Design — Salon Management SaaS (Phase 1)

## Overview

Phase 1 is a modular-monolith REST API backing a React management dashboard. It delivers
authentication, tenant-isolated salon operations, employee/service/availability management,
customer management, and concurrency-safe booking creation with calendar/list views.

```
Users → React (TS + Tailwind + Redux Toolkit) → HTTPS → Node.js/Express REST API → Prisma → PostgreSQL
```

The backend owns authentication, authorization, tenant isolation, availability calculation,
and booking validation. The frontend is never trusted for security decisions.

### Design goals

- **Tenant isolation as a first-class concern** — enforced at the data-access layer, not just routes.
- **Authoritative backend authorization** — every protected request establishes user + salon + role.
- **Concurrency-safe bookings** — conflicting bookings for the same professional cannot both succeed.
- **Logical module boundaries** — modules are separated so they can evolve independently.
- **Simplicity for rapid prototyping** — no premature infrastructure (no Redis/queues/jobs in Phase 1).

---

## Architecture

### Backend module layout (modular monolith)

```
backend/
  src/
    app.ts                      # Express app assembly
    server.ts                   # bootstrap
    config/                     # env, constants (slot size, window)
    prisma/                     # schema.prisma, client, seed
    core/
      auth/                     # JWT issue/verify, password hashing, refresh tokens
      middleware/               # authenticate, authorize(role), tenantContext, errorHandler, validate
      http/                     # error types, response helpers
      openapi/                  # swagger spec assembly
    modules/
      salons/                   # controller, service, routes, dto
      users/                    # salon-level users + roles
      employees/
      services/
      availability/             # slot calculation engine
      customers/
      bookings/                 # concurrency-safe creation, calendar/list
    tests/                      # jest unit + api tests
```

Each module exposes `routes → controller → service → prisma`. Controllers handle HTTP,
services hold business logic, and all salon-scoped Prisma access goes through a
**tenant-scoped repository helper** that injects `salonId` into every query.

### Layered request flow

```
Request
  → authenticate (verify access token, attach { userId, role, salonId | null })
  → tenantContext (resolve effective salonId; super admin has null)
  → authorize(requiredRoles / requiredPermission)
  → validate (zod schema on body/query/params)
  → controller → service → tenant-scoped repository → Prisma → PostgreSQL
  → response | errorHandler (consistent error shape)
```

### Tenant isolation strategy

- Salon-level JWTs carry `salonId`. It is **never** read from the request body/query.
- A `tenantScoped(prisma, salonId)` helper wraps model access so `where` always includes `salonId`.
- Cross-tenant reference resolves to **404**, never 403, so existence is not revealed (Req 2.3).
- Super Admin tokens carry `role: SUPER_ADMIN` and `salonId: null`; they use platform-only endpoints and cannot hit salon-scoped resource endpoints as a tenant.

---

## Data Model (PostgreSQL via Prisma)

### Entity-relationship overview

```
Salon 1──* User
Salon 1──* Employee
Salon 1──* Service
Salon 1──* Customer
Salon 1──* Booking
Salon 1──* Holiday

Employee *──* Service           (EmployeeService: services a professional can perform)
Employee 1──* WorkingHour        (per weekday)
Employee 1──* Break              (per weekday, within a working window)
Employee 1──* Leave              (date range)
Employee 1──* ScheduleOverride   (temporary schedule change for a specific date)

Booking 1──* BookingItem
BookingItem *──1 Service
BookingItem *──1 Employee
Booking *──1 Customer
```

### Key tables and fields

- **Salon**: `id`, `name`, `timezone` (IANA), `contactPhone?`, `contactEmail?`, `status` (ACTIVE/INACTIVE), `createdAt`.
- **User**: `id`, `salonId?` (null for Super Admin), `email` (unique platform-wide), `passwordHash`, `role` (SUPER_ADMIN | OWNER | MANAGER | RECEPTIONIST), `status`, `createdAt`.
- **RefreshToken**: `id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt?`. (Hashed, rotate on use.)
- **Employee**: `id`, `salonId`, `name`, `phone`, `email`, `role`, `specialization`, `weeklyOff` (0–6, Sun=0), `status`, `createdAt`.
- **Service**: `id`, `salonId`, `name`, `durationMinutes` (multiple of 15), `price` (Decimal), `status`.
- **EmployeeService**: `employeeId`, `serviceId` (composite PK) — skills matrix.
- **WorkingHour**: `id`, `employeeId`, `weekday` (0–6), `startMinute`, `endMinute` (minutes from 00:00, within 360–1440 = 06:00–24:00).
- **Break**: `id`, `employeeId`, `weekday`, `startMinute`, `endMinute`.
- **Leave**: `id`, `employeeId`, `startDate`, `endDate` (inclusive, salon-local dates).
- **ScheduleOverride**: `id`, `employeeId`, `date`, `type` (EXTRA_HOURS | TIME_OFF), `startMinute?`, `endMinute?`. Overrides normal schedule for that date.
- **Holiday**: `id`, `salonId`, `date`, `name`. Salon-wide non-working day.
- **Customer**: `id`, `salonId`, `name`, `phone`, `email?`, `createdAt`. Unique `(salonId, phone)` to avoid duplicates.
- **Booking**: `id`, `salonId`, `customerId`, `startAt` (UTC), `endAt` (UTC), `status` (BOOKED), `createdBy`, `createdAt`.
- **BookingItem**: `id`, `bookingId`, `serviceId`, `employeeId`, `startAt` (UTC), `endAt` (UTC).

### Indexing & constraints (concurrency + isolation)

- Every salon-scoped table indexed on `salonId` (and `(salonId, ...)` composites used in queries).
- `Customer`: unique index `(salonId, phone)`.
- `User`: unique index on `email`.
- `BookingItem`: index `(employeeId, startAt, endAt)` for conflict detection.
- Booking creation runs in a `SERIALIZABLE` transaction (see Booking design) and re-checks conflicts inside the transaction.

### Time storage

- All instants (`startAt`, `endAt`) stored as UTC `timestamptz`.
- Schedule definitions (working hours, breaks) stored as **minutes-from-midnight in the salon's local day**; converted to UTC instants during availability/booking using the salon timezone.
- Dates (leave, holiday, override) stored as salon-local calendar dates.

---

## API Contract (REST, documented via OpenAPI/Swagger)

Base path `/api`. All responses use a consistent envelope for errors:

```json
{ "error": { "code": "CONFLICT", "message": "...", "details": [{ "field": "phone", "message": "..." }] } }
```

Status codes: 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden,
404 not found (incl. cross-tenant), 409 conflict (booking), 500 server error.

### Auth
- `POST /api/auth/login` → `{ accessToken }` + Set-Cookie refresh (httpOnly). (Req 1)
- `POST /api/auth/refresh` → rotates refresh, returns new `{ accessToken }`. (Req 1.3, 1.4)
- `POST /api/auth/logout` → revokes refresh. (Req 1.5)
- `GET  /api/auth/me` → current user + salon + role.

### Platform (Super Admin only)
- `POST /api/platform/salons` → create salon + initial Owner. (Req 4.1, 4.2)
- `GET  /api/platform/salons` → list salons. (Req 4.3)

### Salon settings (Owner; read for Manager)
- `GET  /api/salon` / `PUT /api/salon` → salon settings (Owner edits). (Req 5)
- `GET/POST /api/salon/users`, `PATCH/DELETE /api/salon/users/:id` → salon users (Owner/Manager per rules). (Req 3, 5.4)

### Employees (Owner/Manager write; Receptionist read)
- `GET/POST /api/employees`, `GET/PUT/DELETE /api/employees/:id`. (Req 6)
- Nested schedule updates: working hours, breaks, weekly off, leave, overrides on the employee payload or sub-routes `/employees/:id/leave`, `/employees/:id/overrides`.

### Services (Owner/Manager write; Receptionist read)
- `GET/POST /api/services`, `GET/PUT/DELETE /api/services/:id`. (Req 7)

### Availability (all salon roles read)
- `GET /api/availability?date=YYYY-MM-DD&serviceIds=a,b&employeeId=?` → per-professional available slots for the total service duration. (Req 8)

### Customers (all salon roles; Receptionist write)
- `GET /api/customers?search=` → search by name/phone. (Req 9.2)
- `POST /api/customers` → create (dedupe by phone). (Req 9.1, 9.3)

### Bookings (all salon roles; Receptionist write)
- `POST /api/bookings` → create multi-service booking (concurrency-safe). (Req 10)
- `GET  /api/bookings?from=&to=&employeeId=` → list for calendar/list. (Req 11)
- `GET  /api/bookings/:id` → booking details. (Req 11.4)

---

## Availability Calculation Engine

Computes bookable start slots for a given professional, date, and total service duration.

**Inputs:** `salonTimezone`, `date` (salon-local), `employeeId`, `totalDurationMinutes`
(sum of selected services), plus the professional's schedule and existing bookings.

**Algorithm (per professional):**

1. **Base window:** Determine the employee's working intervals for the weekday from `WorkingHour`, intersected with the platform window 06:00–24:00 (360–1440 minutes).
2. **Apply overrides:** If a `ScheduleOverride` exists for `date`:
   - `TIME_OFF` → subtract that interval (or whole day) from the base window.
   - `EXTRA_HOURS` → add that interval to the base window.
3. **Off/leave/holiday:** If the weekday equals `weeklyOff`, or `date` falls in any `Leave` range, or a salon `Holiday` exists for `date` → return `[]` (no slots). (Req 8.5)
4. **Subtract breaks:** Remove `Break` intervals for the weekday from the working intervals → list of free intervals.
5. **Subtract existing bookings:** Convert the professional's existing `BookingItem`s on that date (from UTC) to salon-local minutes and subtract them from the free intervals.
6. **Generate slots:** For each remaining free interval `[s, e)`, emit start times at 15-minute steps where `start + totalDurationMinutes <= e`. (Req 8.2, 8.4)
7. **Convert to UTC:** Map each slot start (salon-local minutes on `date`) to a UTC instant using the salon timezone; return slots as UTC instants (frontend renders in salon tz).

Only professionals whose `EmployeeService` set covers all selected services are considered. (Req 8.6)

**Interval math** is implemented as pure functions (merge, subtract, intersect on `[startMinute, endMinute)`), making the core unit-testable without a database. (Req 12.4)

---

## Concurrency-Safe Booking Creation

A slot shown as available in the UI is not a guarantee; two receptionists may target the
same professional concurrently. Booking creation therefore validates inside a transaction.

**Multi-service scheduling model:**
- Services assigned to the **same professional** are scheduled **sequentially** (no overlap), in the order provided, each starting when the previous finishes. (Req 10.6)
- Services assigned to **different professionals** may run in **parallel**. (Req 10.7)
- The booking's overall `startAt`/`endAt` span the earliest start to the latest end across items.

**Creation procedure (single transaction, `SERIALIZABLE` isolation):**

1. Resolve or create the customer within the salon (dedupe by `(salonId, phone)`). (Req 9, 10.2)
2. Compute each `BookingItem`'s `[startAt, endAt)` from the requested start, per-professional sequencing, and service durations.
3. For every item, **re-validate** against the professional's schedule (working hours, breaks, weekly off, leave, holiday, overrides) for that date. (Req 10.3, 10.5)
4. For every item, query existing `BookingItem`s for the same `employeeId` overlapping `[startAt, endAt)`; if any overlap exists → **abort** with 409 and persist nothing. (Req 10.4, 10.5)
5. Insert `Booking` + all `BookingItem`s.
6. Commit. On serialization failure, retry a bounded number of times; if still conflicting, return 409.

Overlap predicate: `existing.startAt < new.endAt AND existing.endAt > new.startAt`.

`SERIALIZABLE` transactions plus the `(employeeId, startAt, endAt)` index ensure that two
concurrent transactions cannot both commit overlapping items for the same professional;
one will fail serialization and retry/abort. (Req 10.4)

---

## Authentication & Authorization Design

- **Passwords:** hashed with bcrypt (cost ≥ 12). Plaintext never stored. (Req 1.7)
- **Access token:** JWT (~15 min), payload `{ sub: userId, role, salonId }`, signed HS256. Held in memory on the client.
- **Refresh token:** opaque random value, stored hashed in `RefreshToken`, delivered as httpOnly + Secure + SameSite cookie; rotated on each refresh; revoked on logout. (Req 1.1, 1.3–1.5)
- **authenticate middleware:** verifies access token, attaches principal.
- **authorize middleware:** `authorize(...roles)` and a permission map for finer checks (e.g. Receptionist read-only on employees/services). (Req 3)
- **Permission matrix:**

| Action                         | Owner | Manager | Receptionist |
|--------------------------------|:-----:|:-------:|:------------:|
| Salon settings edit            |  ✔    |   ✖     |     ✖        |
| Manage salon users             |  ✔    |  ✔*     |     ✖        |
| Employees CRUD                 |  ✔    |   ✔     |     ✖ (read) |
| Services CRUD                  |  ✔    |   ✔     |     ✖ (read) |
| Availability read              |  ✔    |   ✔     |     ✔        |
| Customers create/update        |  ✔    |   ✔     |     ✔        |
| Bookings create                |  ✔    |   ✔     |     ✔        |
| Bookings/calendar read         |  ✔    |   ✔     |     ✔        |

`*` Manager can manage Receptionists but not Owners or salon settings. (Req 3.3, 5.4)

---

## Frontend Design (React + TS + Tailwind + Redux Toolkit)

```
frontend/src/
  core/
    auth/            # login, token refresh, auth slice, ProtectedRoute, role guards
    api/             # axios client with access-token injection + 401→refresh interceptor
    router/          # route definitions
  shared/
    components/      # Button, Input, Modal, Table, DatePicker, TimeGrid, Toast
    forms/           # form wrappers + validation
    utils/           # tz formatting, time helpers
  features/
    dashboard/       # overview
    salon/           # settings + users (Owner)
    employees/       # roster, skills, schedule editor
    services/        # service catalog
    availability/    # availability viewer
    customers/       # search/create
    bookings/        # create flow + calendar view + list view
  store/             # Redux Toolkit store, RTK Query or slices per feature
```

**Layout:** persistent left sidebar (role-aware nav), top bar (salon name, user, logout),
content area. Clean, professional dashboard styling with Tailwind (neutral surface, one
accent color, accessible contrast, keyboard-focusable controls).

**Booking create flow (matches HLD workflow):**
customer info/search → select service(s) → system shows eligible professionals →
select professional(s)/slot → confirm → POST /api/bookings (backend re-validates).

**Auth handling:** access token in memory (Redux); axios interceptor calls `/auth/refresh`
on 401 using the httpOnly cookie and retries the original request; on refresh failure,
redirect to login.

**Role-aware UI:** navigation and actions are hidden/disabled by role for UX only; the
backend remains authoritative (Req 3.6).

---

## Error Handling

- Central Express error handler maps typed errors (`ValidationError`, `AuthError`,
  `ForbiddenError`, `NotFoundError`, `ConflictError`) to the consistent envelope and status.
- Cross-tenant access → `NotFoundError` (404) to avoid leaking existence. (Req 2.3)
- Validation via zod at the edge; field-level messages returned as `details`. (Req 12.3)

---

## Testing Strategy (Jest)

- **Unit:** interval math (merge/subtract/intersect), availability engine (breaks, off/leave/holiday, overrides, duration fit, tz conversion).
- **Concurrency:** booking creation with simulated concurrent requests targeting the same professional/slot — exactly one succeeds. (Req 10.4)
- **Authorization:** matrix tests per role for each protected action (403 where denied). (Req 3)
- **Tenant isolation:** salon A cannot read/mutate salon B records; cross-tenant returns 404. (Req 2)
- **API:** auth login/refresh/logout, customer dedupe, booking create happy path + conflict (409).

---

## Deployment (prototype)

- Local dev via `docker-compose` (PostgreSQL) + `npm run dev` for API and frontend.
- Prototype hosting on free tiers: static React host, hosted Node/Express, hosted PostgreSQL.
- Environment via `.env` (DB URL, JWT secrets, cookie settings, CORS origin). Secrets never committed.
- HTTPS enforced in hosted environments; Secure cookies. (Req 12.5)
