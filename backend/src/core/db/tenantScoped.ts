import type { Prisma } from '@prisma/client';

/**
 * Builds a reusable `where` fragment that pins every salon-scoped query to a
 * single tenant. Routing all salon data access through this helper enforces
 * tenant isolation structurally rather than relying on ad-hoc per-query filters
 * (Correctness Property 4: tenant isolation).
 *
 * Cross-tenant references therefore resolve to "no row", which callers surface
 * as 404 — indistinguishable from a genuinely non-existent record.
 */
export const tenantWhere = (salonId: string): { salonId: string } => ({ salonId });

/**
 * Merge a tenant filter into an existing `where` clause. Generic over the
 * model's where-input type so callers keep full type-safety.
 */
export const withTenant = <W extends { salonId?: unknown }>(
  salonId: string,
  where?: W,
): W & { salonId: string } => ({ ...(where ?? ({} as W)), salonId });

export type TransactionClient = Prisma.TransactionClient;
