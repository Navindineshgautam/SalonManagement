import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth/jwt';
import { unauthenticated } from '../http/errors';
import type { Principal } from './principal';

/**
 * Verifies the Bearer access token and attaches the principal to the request.
 * Rejects with 401 when the header is missing or the token is invalid/expired.
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(unauthenticated('Missing access token'));
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyAccessToken(token);
  const principal: Principal = {
    userId: payload.sub,
    role: payload.role,
    salonId: payload.salonId,
  };
  req.principal = principal;
  next();
};

/** Retrieve the authenticated principal or throw (guards against misordered middleware). */
export const requirePrincipal = (req: Request): Principal => {
  if (!req.principal) throw unauthenticated();
  return req.principal;
};
