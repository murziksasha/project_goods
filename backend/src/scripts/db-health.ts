import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { getDatabaseHealth } from '../domain/system/db-health';

const formatUptime = (seconds: number | null) => {
  if (seconds === null) return 'n/a';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const run = async () => {
  await connectDatabase();
  const health = await getDatabaseHealth();

  console.log(`Status: ${health.status} (ok=${health.ok}) @ ${health.collectedAt}`);
  console.log(
    `DB: ${health.dbName ?? 'n/a'} · readyState=${health.readyState} · latency=${health.latencyMs ?? 'n/a'} ms`,
  );
  console.log(
    `Mongo: ${health.mongoVersion ?? 'n/a'} · uptime=${formatUptime(health.uptimeSeconds)} · connections=${health.connections.current ?? 'n/a'}/${health.connections.available ?? 'n/a'}`,
  );
};

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
