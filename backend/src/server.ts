import { createApp } from './app';
import { config } from './config';
import { prisma } from './core/db/prisma';

const app = createApp();

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${config.port}/api (docs: /api/docs)`);
});

const shutdown = async (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
