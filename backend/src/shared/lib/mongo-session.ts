import mongoose from 'mongoose';
import { env } from '../../config/env';
import { HttpError } from './errors';

const transactionMaxCommitTimeMS = 8_000;

let replicaSetSupported: boolean | null = null;

const canUseMongoTransactions = async () => {
  if (replicaSetSupported !== null) {
    return replicaSetSupported;
  }

  const admin = mongoose.connection.db?.admin();
  if (!admin) {
    replicaSetSupported = false;
    return false;
  }

  try {
    await admin.command({ replSetGetStatus: 1 });
    replicaSetSupported = true;
    return true;
  } catch {
    replicaSetSupported = false;
    return false;
  }
};

/** Test helper: reset cached RS detection. */
export const resetMongoTransactionCapabilityCache = () => {
  replicaSetSupported = null;
};

/**
 * Runs `operation` inside a Mongo multi-doc transaction when the driver is connected
 * and a replica set is available.
 *
 * When `MONGO_REQUIRE_TRANSACTIONS` is true (default in production), missing RS fails
 * with 503 instead of silently running without atomicity.
 * When false (typical unit tests / local without RS), falls back to no-session.
 */
export const withOptionalMongoSession = async <T>(
  operation: (session?: mongoose.ClientSession) => Promise<T>,
) => {
  if (mongoose.connection.readyState !== 1) {
    if (env.requireMongoTransactions) {
      throw new HttpError(
        503,
        'Database is not connected; transactional operation cannot run.',
      );
    }
    return operation();
  }

  const useTransaction = await canUseMongoTransactions();
  if (!useTransaction) {
    if (env.requireMongoTransactions) {
      throw new HttpError(
        503,
        'MongoDB replica set is required for this operation. Ensure MONGO_URI uses a replica set (e.g. rs0).',
      );
    }
    console.warn(
      'MongoDB replica set is not available; running operation without transaction.',
    );
    return operation();
  }

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(
      async () => {
        result = await operation(session);
      },
      { maxCommitTimeMS: transactionMaxCommitTimeMS },
    );
    return result as T;
  } finally {
    await session.endSession();
  }
};
