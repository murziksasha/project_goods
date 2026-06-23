import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackupMetadata } from './service';

vi.mock('./service', () => ({
  createScheduledBackup: vi.fn(),
  deleteOldScheduledBackups: vi.fn(),
}));

import { createScheduledBackup, deleteOldScheduledBackups } from './service';
import {
  getUtcDateKey,
  isScheduledBackupDue,
  runDailyBackupCycle,
  startBackupScheduler,
} from './scheduler';

const makeBackup = (
  status: BackupMetadata['status'],
  error = '',
): BackupMetadata => ({
  id: 'project-goods-20260607-150000-scheduled',
  createdAt: '2026-06-07T15:00:00.000Z',
  updatedAt: '2026-06-07T15:00:01.000Z',
  status,
  type: 'scheduled',
  archiveFile: 'project-goods-20260607-150000-scheduled.archive.gz',
  sizeBytes: 7,
  author: 'System',
  durationMs: 1000,
  error,
});

describe('backup scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteOldScheduledBackups).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isScheduledBackupDue', () => {
    it('fires at 15:00 UTC regardless of local timezone', () => {
      const utcFifteen = new Date('2026-06-07T15:00:00.000Z');
      expect(isScheduledBackupDue(utcFifteen, '')).toBe(true);

      const utcTwelve = new Date('2026-06-07T12:00:00.000Z');
      expect(isScheduledBackupDue(utcTwelve, '')).toBe(false);
    });

    it('does not rerun on the same UTC day', () => {
      const now = new Date('2026-06-07T15:00:00.000Z');
      expect(isScheduledBackupDue(now, getUtcDateKey(now))).toBe(false);
    });
  });

  describe('runDailyBackupCycle', () => {
    it('runs retention when scheduled backup fails', async () => {
      vi.mocked(createScheduledBackup).mockResolvedValue(
        makeBackup('failed', 'mongodump was not found.'),
      );

      await runDailyBackupCycle();

      expect(deleteOldScheduledBackups).toHaveBeenCalledWith(14);
    });

    it('runs retention when scheduled backup throws', async () => {
      vi.mocked(createScheduledBackup).mockRejectedValue(
        new Error('Backup create operation is already running.'),
      );

      await runDailyBackupCycle();

      expect(deleteOldScheduledBackups).toHaveBeenCalledWith(14);
    });

    it('runs retention when scheduled backup succeeds', async () => {
      vi.mocked(createScheduledBackup).mockResolvedValue(makeBackup('completed'));

      await runDailyBackupCycle();

      expect(deleteOldScheduledBackups).toHaveBeenCalledWith(14);
    });
  });

  describe('startBackupScheduler', () => {
    it('runs retention on startup', async () => {
      const timer = startBackupScheduler();

      await vi.waitFor(() => {
        expect(deleteOldScheduledBackups).toHaveBeenCalledWith(14);
      });

      clearInterval(timer);
    });
  });
});