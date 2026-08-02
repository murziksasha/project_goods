import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { getDatabaseHealth } from './db-health';

describe('getDatabaseHealth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns degraded when database is not connected', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 0,
    });
    Object.defineProperty(mongoose.connection, 'db', {
      configurable: true,
      value: undefined,
    });

    const health = await getDatabaseHealth(
      () => new Date('2026-07-28T12:00:00.000Z'),
    );

    expect(health).toEqual({
      status: 'degraded',
      ok: false,
      readyState: 0,
      latencyMs: null,
      dbName: null,
      mongoVersion: null,
      uptimeSeconds: null,
      connections: { current: null, available: null },
      collectedAt: '2026-07-28T12:00:00.000Z',
    });
  });

  it('returns ok with server status when ping succeeds', async () => {
    const command = vi.fn(async (payload: { ping?: number; serverStatus?: number }) => {
      if (payload.ping === 1) return { ok: 1 };
      if (payload.serverStatus === 1) {
        return {
          version: '7.0.14',
          uptime: 86400,
          connections: { current: 8, available: 92 },
        };
      }
      throw new Error(`unexpected command ${JSON.stringify(payload)}`);
    });

    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(mongoose.connection, 'db', {
      configurable: true,
      value: {
        databaseName: 'inventory',
        admin: () => ({ command }),
      },
    });

    const health = await getDatabaseHealth(
      () => new Date('2026-07-28T12:00:00.000Z'),
    );

    expect(health.status).toBe('ok');
    expect(health.ok).toBe(true);
    expect(health.readyState).toBe(1);
    expect(typeof health.latencyMs).toBe('number');
    expect(health.dbName).toBe('inventory');
    expect(health.mongoVersion).toBe('7.0.14');
    expect(health.uptimeSeconds).toBe(86400);
    expect(health.connections).toEqual({ current: 8, available: 92 });
    expect(health.collectedAt).toBe('2026-07-28T12:00:00.000Z');
  });

  it('returns degraded when ping fails', async () => {
    const command = vi.fn(async () => {
      throw new Error('network');
    });

    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(mongoose.connection, 'db', {
      configurable: true,
      value: {
        databaseName: 'inventory',
        admin: () => ({ command }),
      },
    });

    const health = await getDatabaseHealth(
      () => new Date('2026-07-28T12:00:00.000Z'),
    );

    expect(health.status).toBe('degraded');
    expect(health.ok).toBe(false);
    expect(health.dbName).toBe('inventory');
    expect(typeof health.latencyMs).toBe('number');
    expect(health.mongoVersion).toBeNull();
  });

  it('falls back to buildInfo when serverStatus fails', async () => {
    const command = vi.fn(async (payload: {
      ping?: number;
      serverStatus?: number;
      buildInfo?: number;
    }) => {
      if (payload.ping === 1) return { ok: 1 };
      if (payload.serverStatus === 1) throw new Error('unauthorized');
      if (payload.buildInfo === 1) return { version: '6.0.5' };
      throw new Error(`unexpected command ${JSON.stringify(payload)}`);
    });

    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(mongoose.connection, 'db', {
      configurable: true,
      value: {
        databaseName: 'inventory',
        admin: () => ({ command }),
      },
    });

    const health = await getDatabaseHealth(
      () => new Date('2026-07-28T12:00:00.000Z'),
    );

    expect(health.status).toBe('ok');
    expect(health.mongoVersion).toBe('6.0.5');
    expect(health.uptimeSeconds).toBeNull();
    expect(health.connections).toEqual({ current: null, available: null });
  });
});
