import {
  createScheduledBackup,
  deleteOldScheduledBackups,
} from './service';

export const scheduledBackupHourUtc = 15;
export const scheduledBackupMinuteUtc = 0;
export const scheduledBackupRetentionDays = 14;
const checkIntervalMs = 60 * 1000;

export const getUtcDateKey = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join('-');
};

export const isScheduledBackupDue = (date: Date, lastRunDateKey: string) => {
  const dateKey = getUtcDateKey(date);
  return (
    date.getUTCHours() === scheduledBackupHourUtc &&
    date.getUTCMinutes() === scheduledBackupMinuteUtc &&
    lastRunDateKey !== dateKey
  );
};

export const runScheduledBackupRetention = async () => {
  const deletedBackupIds = await deleteOldScheduledBackups(
    scheduledBackupRetentionDays,
  );
  console.log(`Deleted old scheduled backups: ${deletedBackupIds.length}.`);
  return deletedBackupIds;
};

export const runDailyBackupCycle = async () => {
  try {
    const backup = await createScheduledBackup();
    if (backup.status === 'completed') {
      console.log(`Scheduled backup completed: ${backup.id}.`);
      return;
    }

    console.error(
      `Scheduled backup failed: ${backup.id}. ${backup.error || 'Unknown error.'}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Scheduled backup skipped: ${message}`);
  } finally {
    await runScheduledBackupRetention();
  }
};

export const startBackupScheduler = () => {
  let lastRunDateKey = '';

  void runScheduledBackupRetention();

  const runIfDue = async () => {
    const now = new Date();
    if (!isScheduledBackupDue(now, lastRunDateKey)) {
      return;
    }

    lastRunDateKey = getUtcDateKey(now);
    await runDailyBackupCycle();
  };

  void runIfDue();
  const timer = setInterval(() => {
    void runIfDue();
  }, checkIntervalMs);

  return timer;
};