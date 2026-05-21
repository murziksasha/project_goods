import { connectDatabase } from './config/database';
import { env } from './config/env';
import { app } from './app';
import {
  ensureProductArticleIsNotUnique,
  ensureProductNameIsNotUnique,
} from './domain/product/service';

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
    app.listen(env.port, () => {
      console.log(`Backend started on http://localhost:${env.port}`);
    });
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
