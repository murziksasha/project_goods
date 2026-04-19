import { connectDatabase } from './config/database';
import { env } from './config/env';
import { app } from './app';

const startServer = async () => {
  try {
    await connectDatabase();
    app.listen(env.port, () => {
      console.log(`Backend started on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start backend', error);
    process.exit(1);
  }
};

void startServer();
