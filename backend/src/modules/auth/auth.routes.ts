import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/http/asyncHandler';
import { validateBody } from '../../core/middleware/validate';
import { authenticate, requirePrincipal } from '../../core/middleware/authenticate';
import { unauthenticated } from '../../core/http/errors';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from '../../core/auth/cookie';
import { revokeRefreshToken } from '../../core/auth/refreshToken';
import * as authService from './auth.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

// POST /auth/login — public
authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const { response, refreshToken } = await authService.login(email, password);
    setRefreshCookie(res, refreshToken);
    res.status(200).json(response);
  }),
);

// POST /auth/refresh — relies on the refresh cookie
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const presented = readRefreshCookie(req);
    if (!presented) throw unauthenticated('No session');
    const { accessToken, refreshToken } = await authService.refresh(presented);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ accessToken });
  }),
);

// POST /auth/logout — revokes the refresh token
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const presented = readRefreshCookie(req);
    if (presented) await revokeRefreshToken(presented);
    clearRefreshCookie(res);
    res.status(204).send();
  }),
);

// GET /auth/me — requires a valid access token
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const principal = requirePrincipal(req);
    const user = await authService.me(principal.userId);
    res.status(200).json(user);
  }),
);
