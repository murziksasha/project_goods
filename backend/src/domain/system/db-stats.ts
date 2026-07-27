import mongoose from 'mongoose';
import { HttpError } from '../../shared/lib/errors';

export type CollectionStorageStats = {
  name: string;
  count: number;
  sizeBytes: number;
  storageSizeBytes: number;
  totalIndexSizeBytes: number;
  avgObjSizeBytes: number;
  nindexes: number;
};

export type DatabaseStorageStats = {
  dbName: string;
  collectedAt: string;
  dataSizeBytes: number;
  storageSizeBytes: number;
  indexSizeBytes: number;
  collections: CollectionStorageStats[];
  totals: {
    documents: number;
    dataSizeBytes: number;
    storageSizeBytes: number;
    totalIndexSizeBytes: number;
  };
};

const toNonNegativeInt = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
};

export const getDatabaseStorageStats = async (
  now: () => Date = () => new Date(),
): Promise<DatabaseStorageStats> => {
  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) {
    throw new HttpError(503, 'Database is not connected.');
  }

  const dbStats = (await db.stats()) as {
    db?: string;
    dataSize?: number;
    storageSize?: number;
    indexSize?: number;
  };

  const listed = await db.listCollections().toArray();
  const collectionNames = listed
    .map((item) => item.name)
    .filter((name) => Boolean(name) && !name.startsWith('system.'))
    .sort((left, right) => left.localeCompare(right));

  const collections: CollectionStorageStats[] = [];
  for (const name of collectionNames) {
    try {
      const collStats = (await db.command({ collStats: name })) as {
        count?: number;
        size?: number;
        storageSize?: number;
        totalIndexSize?: number;
        avgObjSize?: number;
        nindexes?: number;
      };
      collections.push({
        name,
        count: toNonNegativeInt(collStats.count),
        sizeBytes: toNonNegativeInt(collStats.size),
        storageSizeBytes: toNonNegativeInt(collStats.storageSize),
        totalIndexSizeBytes: toNonNegativeInt(collStats.totalIndexSize),
        avgObjSizeBytes: toNonNegativeInt(collStats.avgObjSize),
        nindexes: toNonNegativeInt(collStats.nindexes),
      });
    } catch {
      // Collection may have been dropped between list and stats.
    }
  }

  const totals = collections.reduce(
    (acc, item) => {
      acc.documents += item.count;
      acc.dataSizeBytes += item.sizeBytes;
      acc.storageSizeBytes += item.storageSizeBytes;
      acc.totalIndexSizeBytes += item.totalIndexSizeBytes;
      return acc;
    },
    {
      documents: 0,
      dataSizeBytes: 0,
      storageSizeBytes: 0,
      totalIndexSizeBytes: 0,
    },
  );

  return {
    dbName: dbStats.db ?? db.databaseName,
    collectedAt: now().toISOString(),
    dataSizeBytes: toNonNegativeInt(dbStats.dataSize),
    storageSizeBytes: toNonNegativeInt(dbStats.storageSize),
    indexSizeBytes: toNonNegativeInt(dbStats.indexSize),
    collections,
    totals,
  };
};
