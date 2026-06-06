import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const defaultPort = 5000;
const defaultMongoUri = 'mongodb://127.0.0.1:27017/inventory';

export type BackendEnv = {
  port: number;
  mongoUri: string;
  clientOrigin?: string;
};

export const parseEnv = (
  rawEnv: Partial<Pick<NodeJS.ProcessEnv, 'PORT' | 'MONGO_URI' | 'CLIENT_ORIGIN'>>,
): BackendEnv => {
  const port = Number(rawEnv.PORT ?? defaultPort);

  return {
    port: Number.isFinite(port) && port > 0 ? port : defaultPort,
    mongoUri: rawEnv.MONGO_URI ?? defaultMongoUri,
    clientOrigin: rawEnv.CLIENT_ORIGIN,
  };
};

export const env = parseEnv(process.env);
