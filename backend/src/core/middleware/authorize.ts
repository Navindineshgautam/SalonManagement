import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../http/contract';
import { forbidden } from '../http/errors';
import { requirePrincipal } from './authenticate';

/**
 * Role gate: allows the request only if the principal's role is in `roles`.
 * Must run after `authenticate`.
 */
export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const principal = requirePrincipal(req);
    if (!roles.includes(principal.role)) {
      next(forbidden());
      return;
    }
    next();
  };

/** Roles that operate inside a salon (everything except the platform super admin). */
export const SALON_ROLES: Role[] = ['OWNER', 'MANAGER', 'RECEPTIONIST'];

/** Guard requiring any salon role (read access to salon-scoped resources). */
export const requireSalonRole = authorize(...SALON_ROLES);
