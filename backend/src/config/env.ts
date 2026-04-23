import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const env = {
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/inventory',
  clientOrigin: process.env.CLIENT_ORIGIN,
};
