import {
  createScheduledBackup,
  deleteOldScheduledBackups,
} from './service';

const scheduledBackupHour = 15;
const scheduledBackupMinute = 0;
const scheduledBackupRetentionDays = 14;
const checkIntervalMs = 60 * 1000;

const getLocalDateKey = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
};

export const startBackupScheduler = () => {
  let lastRunDateKey = '';

  const runIfDue = async () => {
    const now = new Date();
    const dateKey = getLocalDateKey(now);
    if (
      now.getHours() !== scheduledBackupHour ||
      now.getMinutes() !== scheduledBackupMinute ||
      lastRunDateKey === dateKey
    ) {
      return;
    }

    lastRunDateKey = dateKey;

    try {
      const backup = await createScheduledBackup();
      if (backup.status === 'completed') {
        const deletedBackupIds = await deleteOldScheduledBackups(
          scheduledBackupRetentionDays,
        );
        console.log(
          `Scheduled backup completed: ${backup.id}. Deleted old scheduled backups: ${deletedBackupIds.length}.`,
        );
        return;
      }

      console.error(
        `Scheduled backup failed: ${backup.id}. ${backup.error || 'Unknown error.'}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Scheduled backup skipped: ${message}`);
    }
  };

  void runIfDue();
  const timer = setInterval(() => {
    void runIfDue();
  }, checkIntervalMs);

  return timer;
};
