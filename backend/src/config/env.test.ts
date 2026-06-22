import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('preserves default backend env values', () => {
    expect(parseEnv({})).toEqual({
      port: 5000,
      mongoUri: 'mongodb://127.0.0.1:27017/inventory?replicaSet=rs0',
      clientOrigin: undefined,
      backupDir: './backups',
      backupCreateCommand: undefined,
      backupRestoreCommand: undefined,
      backupRestoreUploadLimit: '10gb',
    });
  });

  it('normalizes valid configured values', () => {
    expect(
      parseEnv({
        PORT: '7000',
        MONGO_URI: 'mongodb://db:27017/app',
        CLIENT_ORIGIN: 'http://localhost:5173',
        BACKUP_DIR: '/app/backups',
        BACKUP_CREATE_COMMAND: 'custom-create',
        BACKUP_RESTORE_COMMAND: 'custom-restore',
        BACKUP_RESTORE_UPLOAD_LIMIT: '5gb',
      }),
    ).toEqual({
      port: 7000,
      mongoUri: 'mongodb://db:27017/app',
      clientOrigin: 'http://localhost:5173',
      backupDir: '/app/backups',
      backupCreateCommand: 'custom-create',
      backupRestoreCommand: 'custom-restore',
      backupRestoreUploadLimit: '5gb',
    });
  });

  it('falls back to the default port when PORT is invalid', () => {
    expect(parseEnv({ PORT: 'abc' }).port).toBe(5000);
    expect(parseEnv({ PORT: '0' }).port).toBe(5000);
  });
});
