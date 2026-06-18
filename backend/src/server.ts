import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './utils/prisma';

const startServer = async () => {
  try {
    // Attempt to connect to the database before starting the server
    await prisma.$connect();
    logger.info('✅ Successfully connected to the database');

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Gracefully shutting down...');
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Closed all connections. Exiting process.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error(error, '❌ Failed to start server:');
    process.exit(1);
  }
};

startServer();
