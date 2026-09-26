# Frontend-First Delivery Plan — Phase 1

## Decision

We build the frontend first against mock/placeholder data, freeze the API contract from
the working screens, then implement the backend to that frozen contract. This validates
UI and workflows early and produces an API shape driven by real UI needs.

## Approach

1. **Scaffold** the React app (Vite + TypeScript + Tailwind + Redux Toolkit) using the
   `core / shared / features` structure from `design.md`.
2. **Typed contract** — define request/response types and a single `ApiClient` interface
   covering every endpoint in `design.md` (auth, salon, employees, services, availability,
   customers, bookings). The TypeScript types are the source of truth.
3. **Mock adapter** — implement the `ApiClient` interface with in-memory seed data and
   realistic logic for the tricky parts:
   - availability slot calculation (working hours − breaks − off/leave/holiday − bookings, duration fit)
   - booking conflict detection (409 on overlap) so the UI behaves like production.
4. **Build screens** against the interface (never against the mock directly): login,
   dashboard, salon settings/users, employees + schedule editor, services, availability
   viewer, customers, booking create flow, calendar + list.
5. **Freeze the contract** — once screens are validated, export the contract as an
   OpenAPI document and keep the TS types as the source of truth. Record it in the spec.
6. **Backend to contract** — implement the backend (per the original tasks) against the
   frozen contract, then swap the app from the mock adapter to the real HTTP client. Both
   implement the same `ApiClient` interface, so the switch is a one-line change per env.

## Guardrails (avoid designing an impossible API)

- The mock adapter mirrors `design.md` semantics, including tenant scoping, role
  permissions, availability math, and booking conflicts.
- No screen assumes a response the backend cannot produce.
- Backend implementation does not begin until the contract is frozen.

## Contract freeze checklist

- [ ] All Phase 1 screens implemented and demoable against the mock adapter.
- [ ] Every endpoint in `design.md` represented in the `ApiClient` interface + types.
- [ ] Error shapes (400/401/403/404/409) represented in the mock responses.
- [ ] OpenAPI document generated/reviewed and added to the spec.
- [ ] Sign-off to begin backend implementation.
