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
  /** Scheduled backup max age in days (default 14). */
  backupScheduledRetentionDays: number;
  /** Keep at most this many completed scheduled backups (default 14). */
  backupScheduledMaxCount: number;
  /** Keep at most this many completed safety backups (default 5). */
  backupSafetyMaxCount: number;
  /** 0 = disabled. Total completed backup archive size cap in bytes. */
  backupMaxTotalBytes: number;
  /** Auto-seal finance period at 2y cutoff (default true). */
  financeAutoSealEnabled: boolean;
  /** Auto-purge finance txs covered by active seal (default false). */
  financeAutoPurgeEnabled: boolean;
  /** Create yearly offline dumps for cold sales years (default true). */
  archiveYearlyDumpsEnabled: boolean;
  /** After successful yearly sales dump, delete matching live docs (default false). */
  archiveAutoPurgeSales: boolean;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const parseNonNegativeInt = (value: string | undefined, fallback: number) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.trunc(parsed);
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
      | 'BACKUP_SCHEDULED_RETENTION_DAYS'
      | 'BACKUP_SCHEDULED_MAX_COUNT'
      | 'BACKUP_SAFETY_MAX_COUNT'
      | 'BACKUP_MAX_TOTAL_BYTES'
      | 'FINANCE_AUTO_SEAL'
      | 'FINANCE_AUTO_PURGE'
      | 'ARCHIVE_YEARLY_DUMPS'
      | 'ARCHIVE_AUTO_PURGE_SALES'
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
    backupScheduledRetentionDays: parseNonNegativeInt(
      rawEnv.BACKUP_SCHEDULED_RETENTION_DAYS,
      14,
    ),
    backupScheduledMaxCount: parseNonNegativeInt(rawEnv.BACKUP_SCHEDULED_MAX_COUNT, 14),
    backupSafetyMaxCount: parseNonNegativeInt(rawEnv.BACKUP_SAFETY_MAX_COUNT, 5),
    backupMaxTotalBytes: parseNonNegativeInt(rawEnv.BACKUP_MAX_TOTAL_BYTES, 0),
    financeAutoSealEnabled: parseBoolean(rawEnv.FINANCE_AUTO_SEAL, true),
    financeAutoPurgeEnabled: parseBoolean(rawEnv.FINANCE_AUTO_PURGE, false),
    archiveYearlyDumpsEnabled: parseBoolean(rawEnv.ARCHIVE_YEARLY_DUMPS, true),
    archiveAutoPurgeSales: parseBoolean(rawEnv.ARCHIVE_AUTO_PURGE_SALES, false),
  };
};

export const env = parseEnv(process.env);
