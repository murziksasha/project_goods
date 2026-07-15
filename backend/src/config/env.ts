import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const defaultPort = 5000;
const defaultMongoUri = 'mongodb://127.0.0.1:27017/inventory?replicaSet=rs0';

export type BackendEnv = {
  port: number;
  host: string;
  mongoUri: string;
  clientOrigin?: string;
  requireMongoTransactions: boolean;
  /** 0 = disabled. Idle session expiry in hours. */
  authSessionIdleHours: number;
  openWeatherApiKey?: string;
  backupDir: string;
  backupCreateCommand?: string;
  backupRestoreCommand?: string;
  backupRestoreUploadLimit: string;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

export const parseEnv = (
  rawEnv: Partial<
    Pick<
      NodeJS.ProcessEnv,
      | 'PORT'
      | 'HOST'
      | 'MONGO_URI'
      | 'CLIENT_ORIGIN'
      | 'NODE_ENV'
      | 'MONGO_REQUIRE_TRANSACTIONS'
      | 'AUTH_SESSION_IDLE_HOURS'
      | 'OPENWEATHER_API_KEY'
      | 'BACKUP_DIR'
      | 'BACKUP_CREATE_COMMAND'
      | 'BACKUP_RESTORE_COMMAND'
      | 'BACKUP_RESTORE_UPLOAD_LIMIT'
    >
  >,
): BackendEnv => {
  const port = Number(rawEnv.PORT ?? defaultPort);
  const isProduction = rawEnv.NODE_ENV === 'production';
  const requireMongoTransactions = parseBoolean(
    rawEnv.MONGO_REQUIRE_TRANSACTIONS,
    isProduction,
  );
  const idleHoursRaw = Number(rawEnv.AUTH_SESSION_IDLE_HOURS ?? 0);
  const authSessionIdleHours =
    Number.isFinite(idleHoursRaw) && idleHoursRaw > 0 ? idleHoursRaw : 0;

  return {
    port: Number.isFinite(port) && port > 0 ? port : defaultPort,
    host: rawEnv.HOST?.trim() || '0.0.0.0',
    mongoUri: rawEnv.MONGO_URI ?? defaultMongoUri,
    clientOrigin: rawEnv.CLIENT_ORIGIN,
    requireMongoTransactions,
    authSessionIdleHours,
    openWeatherApiKey: rawEnv.OPENWEATHER_API_KEY?.trim() || undefined,
    backupDir: rawEnv.BACKUP_DIR ?? './backups',
    backupCreateCommand: rawEnv.BACKUP_CREATE_COMMAND,
    backupRestoreCommand: rawEnv.BACKUP_RESTORE_COMMAND,
    backupRestoreUploadLimit: rawEnv.BACKUP_RESTORE_UPLOAD_LIMIT ?? '2gb',
  };
};

export const env = parseEnv(process.env);
