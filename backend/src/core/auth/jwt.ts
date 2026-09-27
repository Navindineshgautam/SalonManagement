import jwt from 'jsonwebtoken';
import { config } from '../../config';
import type { Role } from '../http/contract';
import { unauthenticated } from '../http/errors';

/** Claims carried by the short-lived access token. */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
  /** null for SUPER_ADMIN (platform-level). */
  salonId: string | null;
}

/** Sign an access token (HS256, ~15 min). */
export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, config.jwt.accessSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.jwt.accessTtlMinutes}m`,
  });

/** Verify and decode an access token, or throw UNAUTHENTICATED. */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      algorithms: ['HS256'],
    });
    if (typeof decoded === 'string') throw new Error('unexpected token payload');
    const { sub, role, salonId } = decoded as jwt.JwtPayload & AccessTokenPayload;
    if (!sub || !role) throw new Error('missing claims');
    return { sub, role, salonId: salonId ?? null };
  } catch {
    throw unauthenticated('Invalid or expired token');
  }
};
