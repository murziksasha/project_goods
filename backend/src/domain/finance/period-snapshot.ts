import mongoose from 'mongoose';
import { env } from '../../config/env';
import { HttpError } from '../../shared/lib/errors';
import { createSafetyBackup } from '../backup/service';
import { listCashboxes } from './cashboxes';
import {
  FinancePeriodSnapshot,
  type FinancePeriodSnapshotDocument,
} from './period-snapshot-model';
import {
  Cashbox,
  FinanceTransaction,
  type FinanceTransactionDocument,
} from './model';

/** Raw finance txs older than this many months may be sealed + purged. */
export const FINANCE_RAW_TX_RETENTION_MONTHS = 36;

/** @deprecated Prefer FINANCE_RAW_TX_RETENTION_MONTHS. Derived years for API compat. */
export const FINANCE_RAW_TX_RETENTION_YEARS = FINANCE_RAW_TX_RETENTION_MONTHS / 12;

export type SnapshotBalanceRow = {
  cashboxId: string;
  currency: string;
  amount: number;
};

const getCashboxId = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toString' in value &&
    typeof value.toString === 'function'
  ) {
    return value.toString();
  }
  return String(value);
};

/** Exclusive periodEnd cutoff: start of day UTC, now − 36 months. */
export const getFinanceRawTxCutoff = (now = new Date()) => {
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  cutoff.setUTCMonth(cutoff.getUTCMonth() - FINANCE_RAW_TX_RETENTION_MONTHS);
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff;
};

export const formatFinancePeriodSnapshot = (doc: FinancePeriodSnapshotDocument) => ({
  id: doc._id.toString(),
  periodEnd: doc.periodEnd.toISOString(),
  balances: (doc.balances ?? []).map((row) => ({
    cashboxId: row.cashboxId.toString(),
    currency: row.currency,
    amount: row.amount,
  })),
  sealedAt: doc.sealedAt.toISOString(),
  sealedBy: doc.sealedBy,
  sourceTxCount: doc.sourceTxCount,
  purgedTxCount: doc.purgedTxCount,
  status: doc.status,
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
});

export const getActiveFinancePeriodSnapshot = async () => {
  const snapshot = await FinancePeriodSnapshot.findOne({ status: 'active' })
    .sort({ periodEnd: -1 })
    .lean<FinancePeriodSnapshotDocument | null>();
  return snapshot;
};

/**
 * Reverse-walk current cashbox balances through txs strictly after periodEnd
 * → balances as of periodEnd (exclusive end of sealed history).
 * Amounts are raw rounded (may be negative for audit honesty).
 */
export const computeBalancesAtPeriodEnd = (
  cashboxes: Array<{ id: string; balances: Record<string, number> }>,
  transactionsAfterPeriodEnd: FinanceTransactionDocument[],
): SnapshotBalanceRow[] => {
  const map = new Map<string, number>();
  cashboxes.forEach((cashbox) => {
    Object.entries(cashbox.balances).forEach(([currency, amount]) => {
      map.set(`${cashbox.id}:${currency}`, amount);
    });
  });

  const chronologicalDesc = [...transactionsAfterPeriodEnd].sort((first, second) => {
    const byDate = second.transactionDate.getTime() - first.transactionDate.getTime();
    if (byDate !== 0) return byDate;
    return second.createdAt.getTime() - first.createdAt.getTime();
  });

  chronologicalDesc.forEach((transaction) => {
    // Skip cancelled originals; cancellation txs reverse them in ledger order.
    if ((transaction.status ?? 'active') === 'cancelled' && !transaction.isCancellation) {
      return;
    }
    const fromKey = transaction.fromCashbox
      ? `${getCashboxId(transaction.fromCashbox)}:${transaction.currency}`
      : '';
    const toKey = transaction.toCashbox
      ? `${getCashboxId(transaction.toCashbox)}:${transaction.currency}`
      : '';

    if (transaction.fromCashbox) {
      map.set(fromKey, (map.get(fromKey) ?? 0) + transaction.amount);
    }
    if (transaction.toCashbox) {
      map.set(toKey, (map.get(toKey) ?? 0) - transaction.amount);
    }
  });

  return [...map.entries()].map(([key, amount]) => {
    const [cashboxId, currency] = key.split(':');
    return {
      cashboxId: cashboxId!,
      currency: currency!,
      amount: Math.round(amount * 100) / 100,
    };
  });
};

export const sealFinancePeriodSnapshot = async (
  author: string,
  options: { periodEnd?: Date; now?: Date } = {},
) => {
  const now = options.now ?? new Date();
  const periodEnd = options.periodEnd ?? getFinanceRawTxCutoff(now);

  if (periodEnd.getTime() > now.getTime()) {
    throw new HttpError(400, 'periodEnd cannot be in the future.');
  }

  const existingActive = await getActiveFinancePeriodSnapshot();
  if (existingActive && existingActive.periodEnd.getTime() >= periodEnd.getTime()) {
    return {
      snapshot: formatFinancePeriodSnapshot(existingActive),
      created: false,
      message: 'Active snapshot already covers this period.',
      warnings: [] as string[],
    };
  }

  const cashboxes = await listCashboxes({ includeArchived: true });
  const txsAfter = await FinanceTransaction.find({
    transactionDate: { $gt: periodEnd },
  })
    .sort({ transactionDate: -1, createdAt: -1 })
    .lean<FinanceTransactionDocument[]>();

  const balances = computeBalancesAtPeriodEnd(
    cashboxes.map((cashbox) => ({ id: cashbox.id, balances: cashbox.balances })),
    txsAfter,
  );

  const warnings: string[] = [];
  if (balances.some((row) => row.amount < 0)) {
    console.warn(
      '[finance-seal] negative_balance_at_period_end',
      balances.filter((row) => row.amount < 0),
    );
    warnings.push('negative_balance_at_period_end');
  }

  const sourceTxCount = await FinanceTransaction.countDocuments({
    transactionDate: { $lte: periodEnd },
  });

  if (existingActive) {
    await FinancePeriodSnapshot.updateOne(
      { _id: existingActive._id },
      { $set: { status: 'superseded' } },
    );
  }

  const created = await FinancePeriodSnapshot.create({
    periodEnd,
    balances: balances.map((row) => ({
      cashboxId: new mongoose.Types.ObjectId(row.cashboxId),
      currency: row.currency,
      amount: row.amount,
    })),
    sealedAt: now,
    sealedBy: author,
    sourceTxCount,
    purgedTxCount: 0,
    status: 'active',
  });

  return {
    snapshot: formatFinancePeriodSnapshot(created.toObject() as FinancePeriodSnapshotDocument),
    created: true,
    message: 'Finance period sealed.',
    warnings,
  };
};

export const purgeFinanceTransactionsBeforeActiveSnapshot = async (
  author: string,
  confirmation: unknown,
) => {
  if (String(confirmation ?? '') !== 'PURGE_FINANCE') {
    throw new HttpError(400, 'Confirmation phrase must be PURGE_FINANCE.');
  }

  const active = await getActiveFinancePeriodSnapshot();
  if (!active) {
    throw new HttpError(400, 'No active finance period snapshot. Seal first.');
  }

  if (env.financePurgeRequireSafetyBackup) {
    await createSafetyBackup(author);
  }

  const result = await FinanceTransaction.deleteMany({
    transactionDate: { $lte: active.periodEnd },
  });
  const deleted = result.deletedCount ?? 0;

  await FinancePeriodSnapshot.updateOne(
    { _id: active._id },
    {
      $set: {
        purgedTxCount: (active.purgedTxCount ?? 0) + deleted,
        sealedBy: `${active.sealedBy} / purged by ${author}`,
      },
    },
  );

  return {
    periodEnd: active.periodEnd.toISOString(),
    deletedCount: deleted,
    success: true,
  };
};

/** Auto-seal when policy cutoff is ahead of active snapshot. */
export const ensureFinancePeriodSealed = async (author = 'System') => {
  if (!env.financeAutoSealEnabled) {
    return { skipped: true as const, reason: 'disabled' };
  }
  const cutoff = getFinanceRawTxCutoff();
  const active = await getActiveFinancePeriodSnapshot();
  if (active && active.periodEnd.getTime() >= cutoff.getTime()) {
    return { skipped: true as const, reason: 'up-to-date', periodEnd: active.periodEnd.toISOString() };
  }
  const result = await sealFinancePeriodSnapshot(author, { periodEnd: cutoff });
  return { skipped: false as const, ...result };
};

export const autoPurgeSealedFinanceTransactions = async () => {
  if (!env.financeAutoPurgeEnabled) {
    return { skipped: true as const, reason: 'disabled' };
  }
  try {
    return {
      skipped: false as const,
      ...(await purgeFinanceTransactionsBeforeActiveSnapshot('System', 'PURGE_FINANCE')),
    };
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 400) {
      return { skipped: true as const, reason: error.message };
    }
    throw error;
  }
};

/** Txs used for balance-after: after active seal only (or all if no seal). */
export const loadTransactionsForBalanceAfter = async () => {
  const active = await getActiveFinancePeriodSnapshot();
  const filter = active ? { transactionDate: { $gt: active.periodEnd } } : {};
  return FinanceTransaction.find(filter)
    .sort({ transactionDate: -1, createdAt: -1 })
    .lean<FinanceTransactionDocument[]>();
};

export const listFinancePeriodSnapshots = async () => {
  const rows = await FinancePeriodSnapshot.find()
    .sort({ periodEnd: -1 })
    .limit(50)
    .lean<FinancePeriodSnapshotDocument[]>();
  return rows.map(formatFinancePeriodSnapshot);
};

// Keep Cashbox import used for model registration side-effects in some test graphs.
void Cashbox;
