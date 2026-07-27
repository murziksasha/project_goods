import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { getDatabaseStorageStats } from './db-stats';

describe('getDatabaseStorageStats', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws 503 when database is not connected', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 0,
    });
    Object.defineProperty(mongoose.connection, 'db', {
      configurable: true,
      value: undefined,
    });

    await expect(getDatabaseStorageStats()).rejects.toMatchObject({
      statusCode: 503,
      message: 'Database is not connected.',
    });
  });

  it('aggregates collStats for user collections', async () => {
    const command = vi.fn(async (payload: { collStats?: string }) => {
      if (payload.collStats === 'sales') {
        return {
          count: 10,
          size: 1000,
          storageSize: 2000,
          totalIndexSize: 300,
          avgObjSize: 100,
          nindexes: 4,
        };
      }
      if (payload.collStats === 'system.profile') {
        return { count: 1 };
      }
      return {
        count: 2,
        size: 200,
        storageSize: 400,
        totalIndexSize: 50,
        avgObjSize: 100,
        nindexes: 1,
      };
    });

    const listCollections = vi.fn().mockReturnValue({
      toArray: async () => [{ name: 'sales' }, { name: 'clients' }, { name: 'system.profile' }],
    });

    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(mongoose.connection, 'db', {
      configurable: true,
      value: {
        databaseName: 'inventory',
        stats: async () => ({
          db: 'inventory',
          dataSize: 1200,
          storageSize: 2400,
          indexSize: 350,
        }),
        listCollections,
        command,
      },
    });

    const stats = await getDatabaseStorageStats(() => new Date('2026-07-28T12:00:00.000Z'));

    expect(stats.dbName).toBe('inventory');
    expect(stats.collectedAt).toBe('2026-07-28T12:00:00.000Z');
    expect(stats.collections).toEqual([
      {
        name: 'clients',
        count: 2,
        sizeBytes: 200,
        storageSizeBytes: 400,
        totalIndexSizeBytes: 50,
        avgObjSizeBytes: 100,
        nindexes: 1,
      },
      {
        name: 'sales',
        count: 10,
        sizeBytes: 1000,
        storageSizeBytes: 2000,
        totalIndexSizeBytes: 300,
        avgObjSizeBytes: 100,
        nindexes: 4,
      },
    ]);
    expect(stats.totals).toEqual({
      documents: 12,
      dataSizeBytes: 1200,
      storageSizeBytes: 2400,
      totalIndexSizeBytes: 350,
    });
    expect(command).not.toHaveBeenCalledWith({ collStats: 'system.profile' });
  });
});
