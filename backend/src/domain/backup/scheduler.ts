import { ensureFinancePeriodSealed, autoPurgeSealedFinanceTransactions } from '../finance/period-snapshot';
import { runScheduledYearlyArchives } from '../archive/yearly-dump';
import {
  createScheduledBackup,
  enforceBackupRetention,
} from './service';

export const scheduledBackupHourUtc = 15;
export const scheduledBackupMinuteUtc = 0;
/** Fallback documented default; runtime policy comes from env via enforceBackupRetention. */
export const scheduledBackupRetentionDays = 14;
const checkIntervalMs = 60 * 1000;

export const runDataRetentionMaintenance = async () => {
  try {
    const seal = await ensureFinancePeriodSealed('System');
    console.log('Finance seal maintenance:', seal);
  } catch (error) {
    console.error('Finance seal maintenance failed:', error);
  }

  try {
    const purge = await autoPurgeSealedFinanceTransactions();
    console.log('Finance purge maintenance:', purge);
  } catch (error) {
    console.error('Finance purge maintenance failed:', error);
  }

  try {
    const archives = await runScheduledYearlyArchives('System');
    console.log('Yearly archive maintenance:', archives);
  } catch (error) {
    console.error('Yearly archive maintenance failed:', error);
  }
};

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
  const deletedBackupIds = await enforceBackupRetention();
  console.log(`Backup retention deleted: ${deletedBackupIds.length}.`);
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
    await runDataRetentionMaintenance();
  }
};

export const startBackupScheduler = () => {
  let lastRunDateKey = '';

  void runScheduledBackupRetention();
  void runDataRetentionMaintenance();

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