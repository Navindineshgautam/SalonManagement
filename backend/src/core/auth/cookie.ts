import type { Response, Request } from 'express';
import { config } from '../../config';

const MAX_AGE_MS = () => config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000;

/** Set the httpOnly refresh-token cookie. */
export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(config.cookie.refreshName, token, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: MAX_AGE_MS(),
  });
};

/** Clear the refresh-token cookie (logout). */
export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(config.cookie.refreshName, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: 'lax',
    path: '/api/auth',
  });
};

/** Read the refresh token from the request cookie, if present. */
export const readRefreshCookie = (req: Request): string | undefined => {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[config.cookie.refreshName];
};
