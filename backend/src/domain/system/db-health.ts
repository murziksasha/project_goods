import mongoose from 'mongoose';

export type DatabaseHealthStatus = 'ok' | 'degraded';

export type DatabaseHealth = {
  status: DatabaseHealthStatus;
  ok: boolean;
  readyState: number;
  latencyMs: number | null;
  dbName: string | null;
  mongoVersion: string | null;
  uptimeSeconds: number | null;
  connections: {
    current: number | null;
    available: number | null;
  };
  collectedAt: string;
};

const toNonNegativeIntOrNull = (value: unknown): number | null => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
};

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getDatabaseHealth = async (
  now: () => Date = () => new Date(),
): Promise<DatabaseHealth> => {
  const collectedAt = now().toISOString();
  const readyState = mongoose.connection.readyState;
  const db = mongoose.connection.db;

  if (readyState !== 1 || !db) {
    return {
      status: 'degraded',
      ok: false,
      readyState,
      latencyMs: null,
      dbName: null,
      mongoVersion: null,
      uptimeSeconds: null,
      connections: { current: null, available: null },
      collectedAt,
    };
  }

  const started = Date.now();
  try {
    await db.admin().command({ ping: 1 });
    const latencyMs = Date.now() - started;

    let mongoVersion: string | null = null;
    let uptimeSeconds: number | null = null;
    let connectionsCurrent: number | null = null;
    let connectionsAvailable: number | null = null;

    try {
      const serverStatus = (await db.admin().command({ serverStatus: 1 })) as {
        version?: unknown;
        uptime?: unknown;
        connections?: {
          current?: unknown;
          available?: unknown;
        };
      };
      mongoVersion = toStringOrNull(serverStatus.version);
      uptimeSeconds = toNonNegativeIntOrNull(serverStatus.uptime);
      connectionsCurrent = toNonNegativeIntOrNull(serverStatus.connections?.current);
      connectionsAvailable = toNonNegativeIntOrNull(
        serverStatus.connections?.available,
      );
    } catch {
      try {
        const buildInfo = (await db.admin().command({ buildInfo: 1 })) as {
          version?: unknown;
        };
        mongoVersion = toStringOrNull(buildInfo.version);
      } catch {
        // Keep nulls when admin commands are restricted.
      }
    }

    return {
      status: 'ok',
      ok: true,
      readyState,
      latencyMs,
      dbName: db.databaseName || null,
      mongoVersion,
      uptimeSeconds,
      connections: {
        current: connectionsCurrent,
        available: connectionsAvailable,
      },
      collectedAt,
    };
  } catch {
    return {
      status: 'degraded',
      ok: false,
      readyState,
      latencyMs: Date.now() - started,
      dbName: db.databaseName || null,
      mongoVersion: null,
      uptimeSeconds: null,
      connections: { current: null, available: null },
      collectedAt,
    };
  }
};
