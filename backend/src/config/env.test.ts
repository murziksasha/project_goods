import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('preserves default backend env values', () => {
    expect(parseEnv({})).toEqual({
      port: 5000,
      host: '0.0.0.0',
      mongoUri: 'mongodb://127.0.0.1:27017/inventory?replicaSet=rs0',
      clientOrigin: undefined,
      requireMongoTransactions: false,
      authSessionIdleHours: 0,
      openWeatherApiKey: undefined,
      backupDir: './backups',
      backupCreateCommand: undefined,
      backupRestoreCommand: undefined,
      backupRestoreUploadLimit: '2gb',
    });
  });

  it('normalizes valid configured values', () => {
    expect(
      parseEnv({
        PORT: '7000',
        HOST: '127.0.0.1',
        MONGO_URI: 'mongodb://db:27017/app',
        CLIENT_ORIGIN: 'http://localhost:5173',
        MONGO_REQUIRE_TRANSACTIONS: 'true',
        AUTH_SESSION_IDLE_HOURS: '72',
        OPENWEATHER_API_KEY: ' weather-key ',
        BACKUP_DIR: '/app/backups',
        BACKUP_CREATE_COMMAND: 'custom-create',
        BACKUP_RESTORE_COMMAND: 'custom-restore',
        BACKUP_RESTORE_UPLOAD_LIMIT: '5gb',
      }),
    ).toEqual({
      port: 7000,
      host: '127.0.0.1',
      mongoUri: 'mongodb://db:27017/app',
      clientOrigin: 'http://localhost:5173',
      requireMongoTransactions: true,
      authSessionIdleHours: 72,
      openWeatherApiKey: 'weather-key',
      backupDir: '/app/backups',
      backupCreateCommand: 'custom-create',
      backupRestoreCommand: 'custom-restore',
      backupRestoreUploadLimit: '5gb',
    });
  });

  it('defaults requireMongoTransactions to true in production', () => {
    expect(parseEnv({ NODE_ENV: 'production' }).requireMongoTransactions).toBe(true);
    expect(
      parseEnv({
        NODE_ENV: 'production',
        MONGO_REQUIRE_TRANSACTIONS: 'false',
      }).requireMongoTransactions,
    ).toBe(false);
  });

  it('falls back to the default port when PORT is invalid', () => {
    expect(parseEnv({ PORT: 'abc' }).port).toBe(5000);
    expect(parseEnv({ PORT: '0' }).port).toBe(5000);
  });
});
