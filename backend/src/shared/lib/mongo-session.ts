import mongoose from 'mongoose';

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

/**
 * Runs `operation` inside a Mongo multi-doc transaction when the driver is connected
 * and a replica set is available. Otherwise runs without a session.
 */
export const withOptionalMongoSession = async <T>(
  operation: (session?: mongoose.ClientSession) => Promise<T>,
) => {
  if (mongoose.connection.readyState !== 1) {
    return operation();
  }

  const useTransaction = await canUseMongoTransactions();
  if (!useTransaction) {
    console.warn(
      'MongoDB replica set is not available; running finance operation without transaction.',
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