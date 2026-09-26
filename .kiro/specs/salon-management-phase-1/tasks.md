# Implementation Plan — Salon Management SaaS (Phase 1)

**Delivery strategy: frontend-first.** Build the React app against mock/placeholder data,
freeze the API contract from the working screens, then implement the backend to that
frozen contract and swap the mock adapter for the real HTTP client. See
`frontend-first-plan.md`. Requirement references map back to `requirements.md`.

---

## Part A — Frontend (mock data)

- [ ] 1. Scaffold the React app
  - Create `frontend/` with Vite + React + TypeScript, Tailwind CSS, and Redux Toolkit.
  - Set up the `core / shared / features` folder structure and base tooling (ESLint, Prettier, tsconfig, Vitest).
  - Verify: app boots to a placeholder page, lint and test run green.
  - _Requirements: 12.5_

- [ ] 2. Define the typed API contract
  - Create `core/api/types.ts` with request/response DTOs for every endpoint in `design.md`.
  - Create `core/api/ApiClient.ts` interface with one method per endpoint (auth, salon, salon users, employees + schedule, services, availability, customers, bookings).
  - Define the shared error type (code + message + field details) matching 400/401/403/404/409.
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 3. Implement the mock adapter
  - [ ] 3.1 In-memory seed data: super admin, one salon + owner/manager/receptionist users, employees with skills+schedules, services, customers, sample bookings.
    - _Requirements: 4, 6, 7, 9_
  - [ ] 3.2 Mock availability logic: working hours − breaks − off/leave/holiday − existing bookings, apply overrides, fit total service duration, filter professionals by skills.
    - _Requirements: 8_
  - [ ] 3.3 Mock booking creation: sequential per professional / parallel across professionals, conflict detection returning 409, tenant scoping, role checks.
    - _Requirements: 10_
  - [ ] 3.4 Mock auth: login/refresh/logout/me with in-memory sessions and role/tenant context.
    - _Requirements: 1, 2, 3_

- [ ] 4. App shell and infrastructure
  - Redux Toolkit store; API client provider that injects the active adapter (mock now, HTTP later).
  - Router with `ProtectedRoute` and role-aware guards; auth slice (token in memory).
  - Role-aware layout: sidebar nav, top bar (salon name, user, logout), content area.
  - _Requirements: 1.3, 2.5, 3.6_

- [ ] 5. Shared UI kit (Tailwind)
  - Button, Input/Select, Modal, Table, DatePicker, TimeGrid, Toast, form wrappers + validation.
  - Verify: components render in isolation with consistent, accessible styling.
  - _Requirements: 3.6_

- [ ] 6. Auth screens
  - Login page and full auth flow against the mock adapter (login, refresh, logout, redirect on failure).
  - Verify: login as each role lands on the dashboard with role-appropriate nav.
  - _Requirements: 1.1, 1.6, 3.6_

- [ ] 7. Feature screens (against the ApiClient interface)
  - [ ] 7.1 Dashboard overview.
    - _Requirements: 11_
  - [ ] 7.2 Salon settings + salon-user management (Owner).
    - _Requirements: 5_
  - [ ] 7.3 Employees: roster, skills, and schedule editor (hours/breaks/off/leave/overrides).
    - _Requirements: 6_
  - [ ] 7.4 Services catalog.
    - _Requirements: 7_
  - [ ] 7.5 Availability viewer.
    - _Requirements: 8_
  - [ ] 7.6 Customers: search/create with dedupe hint.
    - _Requirements: 9_
  - [ ] 7.7 Booking create flow: customer → services → eligible professionals → slot → confirm (409 handling).
    - _Requirements: 10_
  - [ ] 7.8 Booking calendar view + list view with date/professional filters, times in salon tz.
    - _Requirements: 11_

- [ ] 8. Frontend verification
  - Smoke-test the full workflow against mock data; role-aware nav; conflict path on booking.
  - Run Vitest component/logic tests (mock availability + booking conflict).
  - _Requirements: 8, 10, 12.4_

---

## Contract Freeze Gate

- [ ] 9. Freeze the API contract
  - Confirm every screen works against the mock adapter and every `design.md` endpoint exists in the `ApiClient` interface + types.
  - Generate an OpenAPI document from the frozen contract and add it to the spec.
  - Sign-off to begin backend implementation.
  - _Requirements: 12.1, 12.2_

---

## Part B — Backend (to the frozen contract)

- [ ] 10. Bootstrap backend and tooling
  - Create `backend/` (Node + TypeScript + Express), ESLint/Prettier/tsconfig, Jest.
  - Add root `docker-compose.yml` for PostgreSQL and `.env.example`.
  - Verify: app starts, `npm test` runs green, Postgres reachable.
  - _Requirements: 12.1, 12.5_

- [ ] 11. Database schema and Prisma
  - [ ] 11.1 `schema.prisma` for all entities with indexes/constraints (`User.email` unique, `Customer(salonId, phone)` unique, `salonId` indexes, `BookingItem(employeeId, startAt, endAt)`); migrate + generate client.
    - _Requirements: 2.4, 6, 7, 9, 10.8_
  - [ ] 11.2 Seed script mirroring the mock seed data.
    - _Requirements: 4_

- [ ] 12. Core HTTP infrastructure and error handling
  - Typed errors + central error handler (consistent envelope matching the frozen contract); zod validation; Express assembly, CORS, health check, Swagger scaffold.
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 13. Authentication and refresh-token flow
  - Password hashing, JWT access, refresh rotate/revoke (httpOnly cookie); `login/refresh/logout/me`.
  - Tests: login success/failure (no enumeration), refresh rotation, logout revocation, 401 without token.
  - _Requirements: 1, 12.4_

- [ ] 14. Auth middleware, tenant context, authorization
  - `authenticate`, `tenantContext` (salonId from token only), `tenantScoped` repo helper, `authorize` + permission map; cross-tenant → 404.
  - Tests: tenant isolation (A→B = 404), role matrix (403 where denied).
  - _Requirements: 2, 3, 12.4_

- [ ] 15. Super Admin platform module
  - `POST /platform/salons` (salon + initial owner, unique email), `GET /platform/salons`; super-admin guard.
  - Tests: non-super-admin 403, duplicate owner email rejected.
  - _Requirements: 4, 12.4_

- [ ] 16. Salon setup and salon-user management
  - `GET/PUT /salon`; `GET/POST/PATCH/DELETE /salon/users` per role rules; timezone validation.
  - Tests: Manager/Receptionist settings edit 403; Manager manages Receptionists not Owners.
  - _Requirements: 5, 3, 12.4_

- [ ] 17. Employee / professional management
  - Employee CRUD + skills (EmployeeService) + schedule sub-resources (hours/breaks/off/leave/overrides), salon-scoped.
  - Tests: Receptionist write 403, tenant scoping, schedule within 06:00–24:00.
  - _Requirements: 6, 12.4_

- [ ] 18. Service management
  - Service CRUD (duration multiple of 15, price), salon-scoped.
  - Tests: duration validation, Receptionist write 403, tenant scoping.
  - _Requirements: 7, 12.4_

- [ ] 19. Availability calculation engine
  - Pure interval math (merge/subtract/intersect); tz ↔ UTC/minutes helpers; engine; `GET /availability`.
  - Tests: breaks/off/leave/holiday, overrides, duration-fit boundaries, tz correctness.
  - _Requirements: 8, 12.4_

- [ ] 20. Customer management
  - `GET /customers?search=`, `POST /customers` with dedupe by `(salonId, phone)`.
  - Tests: search scoping, duplicate phone surfaces existing customer.
  - _Requirements: 9, 12.4_

- [ ] 21. Concurrency-safe booking creation
  - Item scheduling (sequential per professional / parallel across); `POST /bookings` in SERIALIZABLE transaction with re-validation, overlap check, retry-on-serialization-failure else 409.
  - Tests: happy path, conflict 409 (nothing persisted), concurrent requests → exactly one succeeds.
  - _Requirements: 10, 12.4_

- [ ] 22. Booking calendar / list endpoints
  - `GET /bookings?from=&to=&employeeId=`, `GET /bookings/:id`, salon-scoped with details.
  - Tests: tenant scoping, date/professional filtering.
  - _Requirements: 11, 12.4_

- [ ] 23. Finalize OpenAPI and integrate frontend
  - Complete Swagger at `/api/docs` matching the frozen contract; swap the frontend from the mock adapter to the HTTP client; end-to-end smoke test.
  - _Requirements: 12.1, 12.2_

- [ ] 24. Prototype deploy prep
  - `.env.example`, docker-compose, README; free-tier deploy config (frontend host, Node API, hosted Postgres) with HTTPS + Secure cookies.
  - _Requirements: 12.5_
