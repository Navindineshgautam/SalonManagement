# Requirements — Salon Management SaaS (Phase 1)

## Introduction

This document defines the Phase 1 requirements for a multi-tenant, subscription-based
Salon Management SaaS platform. Multiple salons operate on one platform with strictly
isolated operational data. Phase 1 delivers the core operational workflow: authenticate,
set up a salon, manage employees/professionals and services, define professional
availability, manage customers, and create and view bookings.

Phase 1 is a management dashboard (React + TypeScript + Tailwind) backed by a modular
monolith REST API (Node.js/Express) over PostgreSQL (Prisma). Tenant isolation and
authorization are enforced authoritatively on the backend. Booking creation is
concurrency-safe.

### Roles (Phase 1)

- **Super Admin** (platform-level): creates salons and the initial Salon Owner account.
- **Salon Owner** (salon-level): full control within their salon.
- **Salon Manager** (salon-level): same as Owner except cannot manage salon-level users or salon settings.
- **Receptionist** (salon-level): manages customers and bookings; read-only access to employees, services, and availability.

### Key decisions (defaults applied)

- Salon onboarding: Super Admin creates the salon and its first Owner.
- Auth: email + password; JWT access token (in memory) + refresh token (httpOnly cookie). Password reset deferred.
- Availability window: 06:00–24:00, all 7 days. Slot granularity: 15 minutes.
- Service duration: fixed per service in Phase 1.
- Multi-service bookings: sequential per professional; parallel across different professionals.
- Timezone: stored per salon; timestamps persisted in UTC.

### Out of scope for Phase 1 (future phases)

Rescheduling, cancellation, advanced calendar, customer history, notifications/reminders,
payments, invoices, revenue/expense, inventory, product sales, memberships, coupons,
subscription billing/plans/trials, self-service salon onboarding, Redis/queues/jobs,
audit logs, advanced analytics, monitoring.

---

## Requirement 1: Authentication

**User Story:** As a platform or salon user, I want to authenticate securely, so that I can access the system and only the data I am authorized to see.

#### Acceptance Criteria

1. WHEN a user submits valid email and password THEN the system SHALL issue a short-lived JWT access token and a refresh token delivered as an httpOnly cookie.
2. WHEN a user submits invalid credentials THEN the system SHALL reject the request with a 401 and SHALL NOT reveal whether the email exists.
3. WHEN an access token expires AND a valid refresh token is presented THEN the system SHALL issue a new access token without requiring re-login.
4. WHEN a refresh token is invalid, expired, or revoked THEN the system SHALL reject the refresh request with a 401.
5. WHEN a user logs out THEN the system SHALL invalidate the refresh token so it can no longer be used.
6. IF a protected request has no valid access token THEN the system SHALL respond with 401.
7. WHERE a password is stored THEN the system SHALL persist only a salted hash (bcrypt/argon2) and never the plaintext.

---

## Requirement 2: Tenant Isolation

**User Story:** As a salon owner, I want my salon's data to be strictly isolated, so that no other salon can read or modify my records.

#### Acceptance Criteria

1. WHEN a salon-level user makes any request THEN the system SHALL derive the salon/tenant context from the authenticated token, not from client-supplied tenant identifiers.
2. WHEN a salon-level user queries or mutates salon-scoped records THEN the system SHALL restrict all database access to records belonging to that user's salon.
3. IF a salon-level user references a record belonging to another salon THEN the system SHALL respond with 404 (not found) and SHALL NOT confirm the record's existence.
4. WHERE any salon-scoped table is queried at the data-access layer THEN the query SHALL always include the salon/tenant filter.
5. WHEN the frontend enforces any tenant restriction THEN the backend SHALL still independently enforce the same restriction (frontend is not trusted).

---

## Requirement 3: Role-Based Authorization

**User Story:** As a salon owner, I want role-based permissions, so that staff can only perform actions appropriate to their role.

#### Acceptance Criteria

1. WHEN any protected request is made THEN the system SHALL establish the authenticated user, their salon context, and their role before authorizing the action.
2. WHERE a user has the Owner role THEN the system SHALL permit managing users, employees, services, availability, customers, bookings, and salon settings within their salon.
3. WHERE a user has the Manager role THEN the system SHALL permit all Owner actions EXCEPT managing salon-level users and salon settings.
4. WHERE a user has the Receptionist role THEN the system SHALL permit creating/updating customers and bookings and reading employees, services, and availability, and SHALL deny create/update/delete of employees and services.
5. IF a user attempts an action their role does not permit THEN the system SHALL respond with 403.
6. WHERE authorization is enforced THEN the backend SHALL be authoritative regardless of any frontend restriction.

---

## Requirement 4: Super Admin Salon Onboarding

**User Story:** As a Super Admin, I want to create salons and their initial owner, so that new businesses can start using the platform.

#### Acceptance Criteria

1. WHEN a Super Admin creates a salon THEN the system SHALL persist the salon with name, timezone, and status, and SHALL generate a unique tenant identifier.
2. WHEN a Super Admin creates a salon THEN the system SHALL also create the initial Salon Owner user associated with that salon.
3. WHEN a Super Admin views the platform THEN the system SHALL list all salons with their basic details and status.
4. IF a non-Super-Admin attempts a salon-creation or platform-listing action THEN the system SHALL respond with 403.
5. WHERE a Salon Owner is created THEN the system SHALL require a unique email across the platform.

---

## Requirement 5: Salon Setup

**User Story:** As a Salon Owner, I want to configure my salon's core settings, so that operations reflect my business.

#### Acceptance Criteria

1. WHEN an Owner updates salon settings THEN the system SHALL allow editing salon name, timezone, and contact details.
2. WHEN salon settings are saved THEN the system SHALL validate the timezone against a known timezone list.
3. IF a Manager or Receptionist attempts to edit salon settings THEN the system SHALL respond with 403.
4. WHEN an Owner or Manager manages salon-level users THEN the system SHALL support creating salon users with a role of Manager or Receptionist (Owner user management restricted to Owner).

---

## Requirement 6: Employee / Professional Management

**User Story:** As an Owner or Manager, I want to manage professionals, so that the salon roster and their skills are accurate.

#### Acceptance Criteria

1. WHEN an Owner or Manager creates an employee THEN the system SHALL capture name, phone, email, role, and specialization.
2. WHEN an employee is created or edited THEN the system SHALL allow assigning the set of services the employee can perform.
3. WHEN an employee is created or edited THEN the system SHALL allow defining weekly working hours, breaks, and a weekly off day within the 06:00–24:00 window.
4. WHEN an employee is created or edited THEN the system SHALL allow recording leave (date ranges) for that employee.
5. WHERE an employee record is created THEN the system SHALL associate it with the acting user's salon and SHALL NOT allow assigning it to another salon.
6. IF a Receptionist attempts to create, update, or delete an employee THEN the system SHALL respond with 403.
7. WHEN an employee is queried THEN the system SHALL return only employees belonging to the caller's salon.

---

## Requirement 7: Service Management

**User Story:** As an Owner or Manager, I want to manage services, so that bookings reference correct offerings, durations, and prices.

#### Acceptance Criteria

1. WHEN an Owner or Manager creates a service THEN the system SHALL capture name, duration (minutes), and price.
2. WHEN a service duration is provided THEN the system SHALL require it to be a positive multiple of the 15-minute slot granularity.
3. WHERE a service is created THEN the system SHALL associate it with the caller's salon.
4. IF a Receptionist attempts to create, update, or delete a service THEN the system SHALL respond with 403.
5. WHEN services are queried THEN the system SHALL return only services belonging to the caller's salon.

---

## Requirement 8: Availability Management & Calculation

**User Story:** As a Receptionist, I want to see accurate available slots for a professional and service, so that I can book without conflicts.

#### Acceptance Criteria

1. WHEN available slots are requested for a professional, service(s), and date THEN the system SHALL compute availability as working hours minus breaks minus weekly off/leave/holiday minus existing bookings.
2. WHEN computing slots THEN the system SHALL account for the total duration of the selected service(s) so that a slot is only offered if the full service duration fits before the next unavailable period.
3. WHERE a temporary schedule change exists for the affected date THEN the system SHALL override the professional's normal schedule for that date/time.
4. WHEN slots are computed THEN the system SHALL restrict all times to the 06:00–24:00 window and align them to 15-minute boundaries.
5. WHEN a professional is on weekly off, leave, or a salon holiday for the requested date THEN the system SHALL return no available slots for that professional.
6. WHEN availability is requested THEN the system SHALL only consider professionals who can perform the requested service(s).

---

## Requirement 9: Customer Management

**User Story:** As a Receptionist, I want to register and find customers quickly, so that I can create bookings for walk-ins and returning clients without duplicates.

#### Acceptance Criteria

1. WHEN creating a booking THEN the system SHALL allow creating a customer from basic information (name and phone) without prior registration.
2. WHEN a customer is searched by phone or name THEN the system SHALL return matching existing customers within the caller's salon to help avoid duplicates.
3. IF a customer with the same phone already exists in the salon THEN the system SHALL surface the existing customer rather than silently creating a duplicate.
4. WHERE a customer is created THEN the system SHALL associate it with the caller's salon.
5. WHEN customers are queried THEN the system SHALL return only customers belonging to the caller's salon.

---

## Requirement 10: Booking Creation

**User Story:** As a Receptionist, I want to create a booking with one or more services and professionals, so that the client's visit is scheduled correctly and without conflicts.

#### Acceptance Criteria

1. WHEN a booking is created THEN the system SHALL allow one or more service items, each assigned to a professional who can perform that service.
2. WHEN a booking is created THEN the system SHALL associate it with an existing or newly created customer and with the caller's salon.
3. WHEN a booking is created THEN the system SHALL re-validate professional availability at creation time and SHALL NOT rely on availability previously shown in the UI.
4. WHEN two conflicting booking requests target the same professional and overlapping time THEN the system SHALL ensure at most one succeeds using a transactional, concurrency-safe operation.
5. IF any service item conflicts with an existing booking, break, off/leave/holiday, or temporary schedule change THEN the system SHALL reject the entire booking with a clear conflict error and SHALL persist nothing.
6. WHEN a multi-service booking assigns services to the same professional THEN the system SHALL schedule those items sequentially without overlap.
7. WHEN a multi-service booking assigns services to different professionals THEN the system SHALL allow those items to run in parallel.
8. WHERE a booking is persisted THEN the system SHALL store service items, assigned professionals, start/end times (UTC), and the customer reference.

---

## Requirement 11: Booking Calendar / List

**User Story:** As a salon user, I want to view bookings in a calendar and list, so that I can see the day's schedule and details.

#### Acceptance Criteria

1. WHEN a salon user requests bookings for a date or date range THEN the system SHALL return only bookings belonging to their salon.
2. WHEN bookings are displayed THEN the system SHALL present a calendar view by professional and time and a list view with customer, services, professionals, and times.
3. WHEN times are displayed THEN the system SHALL render them in the salon's configured timezone.
4. WHEN a booking is selected THEN the system SHALL show its full details (customer, service items, professionals, start/end).
5. WHERE bookings are queried THEN the system SHALL support filtering by date and by professional.

---

## Requirement 12: API Contract & Non-Functional

**User Story:** As a developer, I want a clear, documented API and quality baseline, so that the frontend and backend integrate reliably.

#### Acceptance Criteria

1. WHERE REST endpoints are defined THEN the system SHALL document them via OpenAPI/Swagger.
2. WHEN the API returns an error THEN the system SHALL use a consistent error shape and appropriate HTTP status codes (400/401/403/404/409/500).
3. WHEN input is received THEN the system SHALL validate request payloads and reject invalid input with 400 and field-level messages.
4. WHERE business logic is implemented THEN the system SHALL include Jest unit/API tests for availability calculation, tenant isolation, authorization, and concurrency-safe booking.
5. WHEN the frontend and backend communicate THEN they SHALL do so over HTTPS.
