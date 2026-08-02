import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { getDatabaseStorageStats } from '../domain/system/db-stats';

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
};

const run = async () => {
  await connectDatabase();
  const stats = await getDatabaseStorageStats();

  console.log(`DB: ${stats.dbName} @ ${stats.collectedAt}`);
  console.log(
    `Totals: docs=${stats.totals.documents}, data=${formatBytes(stats.totals.dataSizeBytes)}, storage=${formatBytes(stats.totals.storageSizeBytes)}, indexes=${formatBytes(stats.totals.totalIndexSizeBytes)}`,
  );
  console.log('Collections:');
  for (const collection of stats.collections) {
    console.log(
      `  ${collection.name.padEnd(28)} count=${String(collection.count).padStart(8)}  data=${formatBytes(collection.sizeBytes).padStart(10)}  storage=${formatBytes(collection.storageSizeBytes).padStart(10)}  idx=${formatBytes(collection.totalIndexSizeBytes).padStart(10)}  avgObj=${formatBytes(collection.avgObjSizeBytes)}`,
    );
  }
};

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
