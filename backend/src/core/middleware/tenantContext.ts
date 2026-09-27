import type { Request } from 'express';
import { forbidden } from '../http/errors';
import { requirePrincipal } from './authenticate';

/**
 * Derive the caller's salonId strictly from the authenticated token — never
 * from the request body or query. This is the load-bearing rule behind tenant
 * isolation (Correctness Property 4): a client cannot act on another tenant by
 * supplying a different salonId, because the value is ignored.
 *
 * Throws FORBIDDEN for principals with no salon context (e.g. SUPER_ADMIN),
 * which have no business touching salon-scoped resources.
 */
export const salonIdOf = (req: Request): string => {
  const principal = requirePrincipal(req);
  if (!principal.salonId) {
    throw forbidden('This action requires a salon context');
  }
  return principal.salonId;
};
