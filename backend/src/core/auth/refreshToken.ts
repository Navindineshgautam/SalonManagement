import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { config } from '../../config';
import { unauthenticated } from '../http/errors';

/**
 * Refresh-token service. The opaque token value is returned to the client once
 * (in an httpOnly cookie); only its SHA-256 hash is persisted. Tokens are
 * single-use: refreshing rotates (revokes the old, issues a new one).
 */

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

const randomToken = (): string => crypto.randomBytes(48).toString('base64url');

const expiryDate = (): Date => {
  const d = new Date();
  d.setDate(d.getDate() + config.jwt.refreshTtlDays);
  return d;
};

/** Issue a new refresh token for a user; returns the opaque value to set as a cookie. */
export const issueRefreshToken = async (userId: string): Promise<string> => {
  const token = randomToken();
  await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(token), expiresAt: expiryDate() },
  });
  return token;
};

/**
 * Validate a presented refresh token and rotate it: the presented token is
 * revoked and a fresh one issued. Returns { userId, token } or throws.
 */
export const rotateRefreshToken = async (
  presented: string,
): Promise<{ userId: string; token: string }> => {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(presented) },
  });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw unauthenticated('Invalid or expired session');
  }
  const rotated = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    const token = randomToken();
    await tx.refreshToken.create({
      data: { userId: record.userId, tokenHash: sha256(token), expiresAt: expiryDate() },
    });
    return token;
  });
  return { userId: record.userId, token: rotated };
};

/** Revoke a presented refresh token (logout). Silent if unknown. */
export const revokeRefreshToken = async (presented: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(presented), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};
