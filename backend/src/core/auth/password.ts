import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;

/** Hash a plaintext password. Plaintext is never stored. */
export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_COST);

/** Verify a plaintext password against a stored hash. */
export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
