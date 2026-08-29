import { connectDatabase } from './config/database';
import { env } from './config/env';
import { app } from './app';
import {
  ensureProductArticleIsNotUnique,
  ensureProductNameIsNotUnique,
} from './domain/product/service';
import { startBackupScheduler } from './domain/backup/scheduler';
import { refreshSupplierOrderDerivedStatuses } from './domain/supplier-order/service';

const getStartupErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const startServer = async () => {
  try {
    await connectDatabase();
    await ensureProductNameIsNotUnique();
    await ensureProductArticleIsNotUnique();
    startBackupScheduler();
    void refreshSupplierOrderDerivedStatuses().catch((error) => {
      console.error('Supplier order derived-status refresh failed on startup:', error);
    });
    const server = app.listen(env.port, env.host, () => {
      console.log(`Backend started on http://${env.host}:${env.port}`);
    });
    // SSE /events/stream must outlive Node's default 300s requestTimeout.
    server.requestTimeout = 0;
    server.headersTimeout = 0;
  } catch (error) {
    console.error(`Failed to start backend: ${getStartupErrorMessage(error)}`);
    console.error(
      `Check that MongoDB is running and MONGO_URI is correct. Current MONGO_URI: ${env.mongoUri}`,
    );
    console.error('For local development with Docker, run: npm run db:up');
    process.exit(1);
  }
};

void startServer();
