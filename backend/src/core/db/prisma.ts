import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client singleton. A single instance is reused across the
 * process (and across hot reloads in dev) to avoid exhausting DB connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type Db = PrismaClient;
