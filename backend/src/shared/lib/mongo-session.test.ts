import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import {
  resetMongoTransactionCapabilityCache,
  withOptionalMongoSession,
} from './mongo-session';

describe('Mongo transaction capability', () => {
  const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  const originalDb = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
  const originalRequireTransactions = env.requireMongoTransactions;
  const command = vi.fn();

  beforeEach(() => {
    resetMongoTransactionCapabilityCache();
    command.mockReset();
    env.requireMongoTransactions = true;
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(mongoose.connection, 'db', {
      configurable: true,
      value: { admin: () => ({ command }) },
    });
  });

  afterEach(() => {
    if (originalReadyState) {
      Object.defineProperty(mongoose.connection, 'readyState', originalReadyState);
    } else {
      Reflect.deleteProperty(mongoose.connection, 'readyState');
    }
    if (originalDb) {
      Object.defineProperty(mongoose.connection, 'db', originalDb);
    } else {
      Reflect.deleteProperty(mongoose.connection, 'db');
    }
    env.requireMongoTransactions = originalRequireTransactions;
    vi.restoreAllMocks();
    resetMongoTransactionCapabilityCache();
  });

  it('uses a transaction for an authenticated replica set without a status privilege', async () => {
    command.mockResolvedValue({ setName: 'rs0', isWritablePrimary: true });
    const session = {
      withTransaction: vi.fn(async (operation: () => Promise<void>) => operation()),
      endSession: vi.fn(async () => undefined),
    };
    const startSession = vi
      .spyOn(mongoose, 'startSession')
      .mockResolvedValue(session as unknown as mongoose.ClientSession);
    const operation = vi.fn(async (activeSession?: mongoose.ClientSession) => {
      expect(activeSession).toBe(session);
      return 'saved';
    });

    await expect(withOptionalMongoSession(operation)).resolves.toBe('saved');
    expect(command).toHaveBeenCalledWith({ hello: 1 });
    expect(startSession).toHaveBeenCalledOnce();
    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('fails closed for a standalone server even when it is writable', async () => {
    command.mockResolvedValue({ isWritablePrimary: true });
    const startSession = vi.spyOn(mongoose, 'startSession');
    const operation = vi.fn(async () => 'unsafe');

    await expect(withOptionalMongoSession(operation)).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(operation).not.toHaveBeenCalled();
    expect(startSession).not.toHaveBeenCalled();
  });

  it('retries capability detection after a transient hello error', async () => {
    command
      .mockRejectedValueOnce(new Error('temporary network error'))
      .mockResolvedValueOnce({ setName: 'rs0', isWritablePrimary: true });
    const session = {
      withTransaction: vi.fn(async (operation: () => Promise<void>) => operation()),
      endSession: vi.fn(async () => undefined),
    };
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(
      session as unknown as mongoose.ClientSession,
    );
    const operation = vi.fn(async () => 'saved');

    await expect(withOptionalMongoSession(operation)).rejects.toMatchObject({
      statusCode: 503,
    });
    await expect(withOptionalMongoSession(operation)).resolves.toBe('saved');
    expect(command).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledOnce();
  });
});
