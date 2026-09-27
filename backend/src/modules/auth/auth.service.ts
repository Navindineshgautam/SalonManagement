import { prisma } from '../../core/db/prisma';
import { signAccessToken } from '../../core/auth/jwt';
import { verifyPassword } from '../../core/auth/password';
import { issueRefreshToken, rotateRefreshToken } from '../../core/auth/refreshToken';
import { unauthenticated } from '../../core/http/errors';
import { toAuthUser } from '../../core/http/mappers';
import type { AuthUser, LoginResponse } from '../../core/http/contract';

/**
 * Authenticate credentials. Returns an access token, refresh token, and the
 * user. To avoid account enumeration, unknown email and wrong password yield
 * the same generic 401 (matches the mock).
 */
export const login = async (
  email: string,
  password: string,
): Promise<{ response: LoginResponse; refreshToken: string }> => {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, status: 'ACTIVE' },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw unauthenticated('Invalid email or password');
  }
  const accessToken = signAccessToken({
    sub: user.id,
    role: toAuthUser(user).role,
    salonId: user.salonId,
  });
  const refreshToken = await issueRefreshToken(user.id);
  return { response: { accessToken, user: toAuthUser(user) }, refreshToken };
};

/** Rotate a refresh token and mint a fresh access token. */
export const refresh = async (
  presented: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const { userId, token } = await rotateRefreshToken(presented);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE') {
    throw unauthenticated('Invalid or expired session');
  }
  const accessToken = signAccessToken({
    sub: user.id,
    role: toAuthUser(user).role,
    salonId: user.salonId,
  });
  return { accessToken, refreshToken: token };
};

/** Load the current user for `GET /auth/me`. */
export const me = async (userId: string): Promise<AuthUser> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthenticated();
  return toAuthUser(user);
};
