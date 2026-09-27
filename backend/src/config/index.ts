/**
 * Central configuration + domain constants.
 * Values mirror the frozen frontend contract (SLOT_MINUTES, operating window)
 * so server-side availability math agrees with the client (Correctness Property 1).
 */

/** Availability slot granularity in minutes. */
export const SLOT_MINUTES = 15;

/** Salon operating window: 06:00 to 24:00 (minutes from midnight). */
export const DAY_START_MINUTE = 6 * 60; // 360
export const DAY_END_MINUTE = 24 * 60; // 1440

const num = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const list = (value: string | undefined, fallback: string[]): string[] =>
  value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : fallback;

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    accessTtlMinutes: num(process.env.ACCESS_TOKEN_TTL_MINUTES, 15),
    refreshTtlDays: num(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
  },
  cors: {
    origins: list(process.env.CORS_ORIGIN, ['http://localhost:5173']),
  },
  cookie: {
    secure: (process.env.COOKIE_SECURE ?? 'false') === 'true',
    /** Name of the refresh-token cookie. */
    refreshName: 'refresh_token',
  },
} as const;

export const isProd = config.env === 'production';
