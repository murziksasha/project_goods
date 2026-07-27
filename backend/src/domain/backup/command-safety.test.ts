import { describe, expect, it } from 'vitest';
import { HttpError } from '../../shared/lib/errors';
import { assertSafeBackupCommandTemplate } from './service';

describe('assertSafeBackupCommandTemplate', () => {
  it('allows simple mongodump-style templates', () => {
    expect(() =>
      assertSafeBackupCommandTemplate(
        'mongodump --uri {mongoUri} --archive={archivePath} --gzip',
        'BACKUP_CREATE_COMMAND',
      ),
    ).not.toThrow();
  });

  it('rejects shell metacharacters', () => {
    expect(() =>
      assertSafeBackupCommandTemplate(
        'mongodump --uri {mongoUri}; rm -rf /',
        'BACKUP_CREATE_COMMAND',
      ),
    ).toThrow(HttpError);
  });

  it('rejects unknown placeholders', () => {
    expect(() =>
      assertSafeBackupCommandTemplate(
        'mongodump --uri {mongoUri} --out {evil}',
        'BACKUP_CREATE_COMMAND',
      ),
    ).toThrow(/unknown placeholders/i);
  });

  it('rejects empty templates', () => {
    expect(() => assertSafeBackupCommandTemplate('   ', 'BACKUP_RESTORE_COMMAND')).toThrow(
      /empty/i,
    );
  });
});
