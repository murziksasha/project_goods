import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';
import { HttpError } from '../../shared/lib/errors';
import { createSafetyBackup } from '../backup/service';
import {
  FINANCE_RAW_TX_RETENTION_MONTHS,
  getFinanceRawTxCutoff,
} from '../finance/period-snapshot';
import { FinanceTransaction } from '../finance/model';
import { Sale } from '../sale/model';
import {
  YearlyArchive,
  type YearlyArchiveDocument,
  type YearlyArchiveKind,
} from './model';

/** Live sales older than this many months are eligible for yearly offline dump. */
export const SALES_HOT_MONTHS = 36;

export const SALES_PURGE_CONFIRMATION = 'PURGE_SALES_YEAR';

export const SALES_TERMINAL_STATUSES = [
  'issued',
  'issuedWithoutRepair',
  'paid',
  'returned',
  'clientRejected',
  'cancelled',
] as const;

const defaultRunCommand = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { shell: false });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(
          new Error(
            `${command} was not found. Install MongoDB Database Tools for yearly dumps.`,
          ),
        );
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });

export type YearlyDumpOptions = {
  archiveDir?: string;
  mongoUri?: string;
  runCommand?: (command: string, args: string[]) => Promise<void>;
  now?: () => Date;
  purge?: boolean;
  /** Manual purge confirmation phrase (PURGE_SALES_YEAR). Not required for system auto-purge. */
  confirmation?: unknown;
  /** Skip safety backup (tests / already backed up this cycle). */
  skipSafetyBackup?: boolean;
};

const getOptions = (options: YearlyDumpOptions = {}) => ({
  archiveDir: options.archiveDir ?? path.join(env.backupDir, 'yearly'),
  mongoUri: options.mongoUri ?? env.mongoUri,
  runCommand: options.runCommand ?? defaultRunCommand,
  now: options.now ?? (() => new Date()),
  purge: options.purge ?? false,
  confirmation: options.confirmation,
  skipSafetyBackup: options.skipSafetyBackup ?? false,
});

export const getSalesHotCutoff = (now = new Date()) => {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - SALES_HOT_MONTHS);
  return cutoff;
};

/** Calendar years fully before hot cutoff (year end < hotCutoff). */
export const listEligibleSalesArchiveYears = (now = new Date()) => {
  const hotCutoff = getSalesHotCutoff(now);
  const lastFullYear = hotCutoff.getFullYear() - 1;
  const years: number[] = [];
  for (let year = 2000; year <= lastFullYear; year += 1) {
    years.push(year);
  }
  return years;
};

/**
 * Full calendar years whose exclusive UTC year-end is at or before finance raw cutoff.
 * Older than 36 months may be sealed + dumped offline.
 */
export const listEligibleFinanceArchiveYears = (now = new Date()) => {
  const cutoff = getFinanceRawTxCutoff(now);
  const years: number[] = [];
  for (let year = 2000; year <= cutoff.getUTCFullYear(); year += 1) {
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    if (yearEnd.getTime() <= cutoff.getTime()) {
      years.push(year);
    }
  }
  return years;
};

const yearBounds = (year: number) => {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
  return { start, end };
};

export const buildSalesYearArchiveQuery = (year: number) => {
  const { start, end } = yearBounds(year);
  return {
    saleDate: { $gte: start, $lt: end },
    status: { $in: [...SALES_TERMINAL_STATUSES] },
  };
};

export const buildFinanceYearArchiveQuery = (year: number) => {
  const { start, end } = yearBounds(year);
  return {
    transactionDate: { $gte: start, $lt: end },
  };
};

export const formatYearlyArchive = (doc: YearlyArchiveDocument) => ({
  id: doc._id.toString(),
  year: doc.year,
  kind: doc.kind,
  status: doc.status,
  archiveFile: doc.archiveFile,
  sizeBytes: doc.sizeBytes,
  documentCount: doc.documentCount,
  prePurgeCount: doc.prePurgeCount ?? doc.documentCount ?? 0,
  checksumSha256: doc.checksumSha256 ?? '',
  verified: Boolean(doc.verified),
  verifiedAt: doc.verifiedAt ? new Date(doc.verifiedAt).toISOString() : null,
  deletedFromLive: doc.deletedFromLive,
  author: doc.author,
  error: doc.error ?? '',
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
});

export const listYearlyArchives = async () => {
  const rows = await YearlyArchive.find()
    .sort({ year: -1, kind: 1 })
    .lean<YearlyArchiveDocument[]>();
  return rows.map(formatYearlyArchive);
};

export const coldSalesPurgedExist = async () =>
  Boolean(
    await YearlyArchive.exists({
      kind: 'sales',
      status: 'completed',
      deletedFromLive: true,
    }),
  );

export const countStaleOpenSales = async (now = new Date()) => {
  const hotCutoff = getSalesHotCutoff(now);
  const filter = {
    saleDate: { $lt: hotCutoff },
    status: { $nin: [...SALES_TERMINAL_STATUSES] },
  };
  const count = await Sale.countDocuments(filter);
  const sample = await Sale.find(filter)
    .select({ recordNumber: 1 })
    .sort({ saleDate: 1 })
    .limit(20)
    .lean<Array<{ _id: { toString(): string }; recordNumber?: string }>>();
  return {
    hotCutoff: hotCutoff.toISOString(),
    count,
    sample: sample.map((row) => ({
      id: row._id.toString(),
      recordNumber: row.recordNumber ?? '',
    })),
  };
};

const ensureArchiveDir = async (archiveDir: string) => {
  await fs.mkdir(archiveDir, { recursive: true });
};

const archiveFileName = (kind: YearlyArchiveKind, year: number) =>
  `project-goods-${kind}-${year}.archive.gz`;

export const hashFileSha256 = (filePath: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });

export const assertDumpFileUsable = async (
  archivePath: string,
  options: { requireNonEmpty?: boolean } = {},
) => {
  let stats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stats = await fs.stat(archivePath);
  } catch {
    throw new HttpError(500, `Archive file missing: ${archivePath}`);
  }
  if (!stats.isFile()) {
    throw new HttpError(500, `Archive path is not a file: ${archivePath}`);
  }
  if (options.requireNonEmpty !== false && stats.size <= 0) {
    throw new HttpError(500, `Archive file is empty: ${archivePath}`);
  }
  return stats;
};

/** mongodump --query expects Extended JSON for Date fields. */
export const toMongoDumpQueryJson = (query: {
  saleDate?: { $gte: Date; $lt: Date };
  transactionDate?: { $gte: Date; $lt: Date };
  status?: { $in: string[] };
}) => {
  const payload: Record<string, unknown> = {};
  if (query.saleDate) {
    payload.saleDate = {
      $gte: { $date: query.saleDate.$gte.toISOString() },
      $lt: { $date: query.saleDate.$lt.toISOString() },
    };
  }
  if (query.transactionDate) {
    payload.transactionDate = {
      $gte: { $date: query.transactionDate.$gte.toISOString() },
      $lt: { $date: query.transactionDate.$lt.toISOString() },
    };
  }
  if (query.status) {
    payload.status = query.status;
  }
  return JSON.stringify(payload);
};

const runCollectionDump = async (
  kind: YearlyArchiveKind,
  year: number,
  query: {
    saleDate?: { $gte: Date; $lt: Date };
    transactionDate?: { $gte: Date; $lt: Date };
    status?: { $in: string[] };
  },
  options: ReturnType<typeof getOptions>,
) => {
  const collection =
    kind === 'sales' ? Sale.collection.name : FinanceTransaction.collection.name;
  const fileName = archiveFileName(kind, year);
  const archivePath = path.join(options.archiveDir, fileName);
  const queryJson = toMongoDumpQueryJson(query);

  await options.runCommand('mongodump', [
    '--uri',
    options.mongoUri,
    `--archive=${archivePath}`,
    '--gzip',
    `--db=${Sale.db.name}`,
    `--collection=${collection}`,
    `--query=${queryJson}`,
  ]);

  const stats = await fs.stat(archivePath);
  const checksumSha256 = await hashFileSha256(archivePath);
  return { fileName, archivePath, sizeBytes: stats.size, checksumSha256 };
};

const markEmptyYearComplete = async (
  record: InstanceType<typeof YearlyArchive>,
  author: string,
  documentCount: number,
) => {
  const now = new Date();
  record.status = 'completed';
  record.documentCount = documentCount;
  record.prePurgeCount = documentCount;
  record.sizeBytes = 0;
  record.checksumSha256 = '';
  record.verified = true;
  record.verifiedAt = now;
  record.error = '';
  record.author = author;
  await record.save();
};

/**
 * Lazy-upgrade legacy completed archives: if file exists and no checksum, hash + verify.
 */
export const ensureArchiveVerified = async (
  record: InstanceType<typeof YearlyArchive> | YearlyArchiveDocument,
  archiveDir: string,
) => {
  if (record.verified && record.checksumSha256) {
    return record;
  }
  if ((record.documentCount ?? 0) === 0) {
    record.verified = true;
    record.verifiedAt = record.verifiedAt ?? new Date();
    record.prePurgeCount = record.prePurgeCount ?? 0;
    if ('save' in record && typeof record.save === 'function') {
      await record.save();
    } else {
      await YearlyArchive.updateOne(
        { _id: record._id },
        {
          $set: {
            verified: true,
            verifiedAt: record.verifiedAt ?? new Date(),
            prePurgeCount: record.prePurgeCount ?? 0,
          },
        },
      );
    }
    return record;
  }

  const archivePath = path.join(archiveDir, record.archiveFile);
  try {
    const stats = await assertDumpFileUsable(archivePath);
    const checksum = record.checksumSha256 || (await hashFileSha256(archivePath));
    const verifiedAt = new Date();
    const patch = {
      sizeBytes: stats.size,
      checksumSha256: checksum,
      verified: true,
      verifiedAt,
      prePurgeCount: record.prePurgeCount ?? record.documentCount ?? 0,
    };
    if ('save' in record && typeof record.save === 'function') {
      Object.assign(record, patch);
      await record.save();
    } else {
      await YearlyArchive.updateOne({ _id: record._id }, { $set: patch });
      Object.assign(record, patch);
    }
  } catch {
    // leave unverified
  }
  return record;
};

const assertSalesPurgeAllowed = async (
  record: InstanceType<typeof YearlyArchive>,
  query: ReturnType<typeof buildSalesYearArchiveQuery>,
  archiveDir: string,
) => {
  await ensureArchiveVerified(record, archiveDir);

  if (!record.verified) {
    throw new HttpError(
      400,
      'Sales purge blocked: dump is not verified. Re-run yearly dump first.',
    );
  }

  if ((record.documentCount ?? 0) > 0) {
    if (!record.checksumSha256) {
      throw new HttpError(400, 'Sales purge blocked: missing dump checksum.');
    }
    const archivePath = path.join(archiveDir, record.archiveFile);
    const stats = await assertDumpFileUsable(archivePath);
    if (stats.size !== record.sizeBytes) {
      throw new HttpError(
        400,
        'Sales purge blocked: dump file size mismatch. Re-run yearly dump.',
      );
    }
    const liveHash = await hashFileSha256(archivePath);
    if (liveHash !== record.checksumSha256) {
      throw new HttpError(
        400,
        'Sales purge blocked: dump checksum mismatch. Re-run yearly dump.',
      );
    }
  }

  const liveCount = await Sale.countDocuments(query);
  const expected = record.documentCount ?? record.prePurgeCount ?? 0;
  if (liveCount !== expected) {
    throw new HttpError(
      400,
      `Sales purge blocked: live count ${liveCount} !== dump count ${expected}. Re-run yearly dump.`,
    );
  }
};

const maybeSafetyBackupForSalesPurge = async (
  author: string,
  options: ReturnType<typeof getOptions>,
) => {
  if (options.skipSafetyBackup || !env.archivePurgeRequireSafetyBackup) {
    return;
  }
  await createSafetyBackup(author);
};

const purgeSalesYearFromLive = async (
  record: InstanceType<typeof YearlyArchive>,
  year: number,
  author: string,
  options: ReturnType<typeof getOptions>,
) => {
  const query = buildSalesYearArchiveQuery(year);
  await assertSalesPurgeAllowed(record, query, options.archiveDir);
  await maybeSafetyBackupForSalesPurge(author, options);

  const deleted = await Sale.deleteMany(query);
  const deletedCount = deleted.deletedCount ?? 0;
  record.deletedFromLive = deletedCount > 0 || (record.documentCount ?? 0) === 0;
  record.author = author;
  await record.save();
  return deletedCount;
};

/** Purge-only path when dump already completed + verified. */
export const purgeOnlySalesYear = async (
  year: number,
  author: string,
  options: YearlyDumpOptions = {},
) => {
  const resolved = getOptions(options);
  const record = await YearlyArchive.findOne({ kind: 'sales', year });
  if (!record) {
    throw new HttpError(400, `No sales yearly archive for ${year}.`);
  }
  if (record.deletedFromLive) {
    return {
      archive: formatYearlyArchive(record.toObject() as YearlyArchiveDocument),
      created: false,
      message: 'Year already purged from live DB.',
      deletedCount: 0,
    };
  }
  if (resolved.purge && resolved.confirmation !== undefined) {
    if (String(resolved.confirmation ?? '') !== SALES_PURGE_CONFIRMATION) {
      throw new HttpError(400, `Confirmation phrase must be ${SALES_PURGE_CONFIRMATION}.`);
    }
  }
  const deletedCount = await purgeSalesYearFromLive(record, year, author, resolved);
  return {
    archive: formatYearlyArchive(record.toObject() as YearlyArchiveDocument),
    created: false,
    message: 'Sales year purged from live DB.',
    deletedCount,
  };
};

export const createYearlySalesDump = async (
  year: number,
  author: string,
  options: YearlyDumpOptions = {},
) => {
  const resolved = getOptions(options);
  const eligible = listEligibleSalesArchiveYears(resolved.now());
  if (!eligible.includes(year)) {
    throw new HttpError(
      400,
      `Year ${year} is still inside the ${SALES_HOT_MONTHS}-month hot window (or invalid).`,
    );
  }

  if (resolved.purge) {
    // Manual purge path requires confirmation when provided by route; auto-purge may omit it.
    if (
      resolved.confirmation !== undefined &&
      String(resolved.confirmation ?? '') !== SALES_PURGE_CONFIRMATION
    ) {
      throw new HttpError(400, `Confirmation phrase must be ${SALES_PURGE_CONFIRMATION}.`);
    }
  }

  await ensureArchiveDir(resolved.archiveDir);
  const query = buildSalesYearArchiveQuery(year);
  const documentCount = await Sale.countDocuments(query);

  const existing = await YearlyArchive.findOne({ kind: 'sales', year });
  if (existing?.status === 'completed' && existing.deletedFromLive) {
    return {
      archive: formatYearlyArchive(existing.toObject() as YearlyArchiveDocument),
      created: false,
      message: 'Year already archived and purged from live DB.',
    };
  }

  // Completed verified dump with file present: optional purge-only without re-dump.
  if (
    existing?.status === 'completed' &&
    existing.verified &&
    !existing.deletedFromLive
  ) {
    await ensureArchiveVerified(existing, resolved.archiveDir);
    const filePresent = await dumpFileOk(
      existing.toObject() as YearlyArchiveDocument,
      resolved.archiveDir,
    );
    if (existing.verified && filePresent) {
      if (resolved.purge || env.archiveAutoPurgeSales) {
        const deletedCount = await purgeSalesYearFromLive(
          existing,
          year,
          author,
          resolved,
        );
        return {
          archive: formatYearlyArchive(existing.toObject() as YearlyArchiveDocument),
          created: false,
          message: 'Sales year dump already present; purged from live.',
          deletedCount,
        };
      }
      return {
        archive: formatYearlyArchive(existing.toObject() as YearlyArchiveDocument),
        created: false,
        message: 'Year already archived (verified dump present).',
        deletedCount: 0,
      };
    }
    // Missing file or lost verify → fall through and re-dump.
    existing.verified = false;
    existing.status = 'running';
    existing.error = 'Re-dumping: previous archive missing or unverified.';
  }

  const record =
    existing ??
    (await YearlyArchive.create({
      year,
      kind: 'sales',
      status: 'running',
      archiveFile: archiveFileName('sales', year),
      sizeBytes: 0,
      documentCount,
      prePurgeCount: documentCount,
      checksumSha256: '',
      verified: false,
      verifiedAt: null,
      deletedFromLive: false,
      author,
      error: '',
      query,
    }));

  try {
    if (documentCount === 0) {
      await markEmptyYearComplete(record, author, 0);
      let deletedCount = 0;
      if (resolved.purge || env.archiveAutoPurgeSales) {
        deletedCount = await purgeSalesYearFromLive(record, year, author, resolved);
      }
      return {
        archive: formatYearlyArchive(record.toObject() as YearlyArchiveDocument),
        created: true,
        message: 'No terminal sales in year; marked complete.',
        deletedCount,
      };
    }

    const dump = await runCollectionDump('sales', year, query, resolved);
    const postCount = await Sale.countDocuments(query);
    record.status = 'completed';
    record.archiveFile = dump.fileName;
    record.sizeBytes = dump.sizeBytes;
    record.checksumSha256 = dump.checksumSha256;
    record.documentCount = documentCount;
    record.prePurgeCount = documentCount;
    record.error = '';
    record.author = author;

    if (postCount !== documentCount) {
      record.verified = false;
      record.verifiedAt = null;
      record.error = `Count changed during dump (${documentCount} → ${postCount}); re-run dump before purge.`;
      await record.save();
      return {
        archive: formatYearlyArchive(record.toObject() as YearlyArchiveDocument),
        created: true,
        message: record.error,
        deletedCount: 0,
      };
    }

    record.verified = true;
    record.verifiedAt = new Date();
    await record.save();

    let deletedCount = 0;
    if (resolved.purge || env.archiveAutoPurgeSales) {
      deletedCount = await purgeSalesYearFromLive(record, year, author, resolved);
    }

    return {
      archive: formatYearlyArchive(record.toObject() as YearlyArchiveDocument),
      created: true,
      message: 'Sales year dump completed.',
      deletedCount,
    };
  } catch (error) {
    record.status = 'failed';
    record.verified = false;
    record.error = error instanceof Error ? error.message : 'Dump failed.';
    await record.save();
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, record.error);
  }
};

export const createYearlyFinanceDump = async (
  year: number,
  author: string,
  options: YearlyDumpOptions = {},
) => {
  const resolved = getOptions(options);

  if (resolved.purge) {
    throw new HttpError(
      400,
      'Finance live purge is only allowed via period seal + PURGE_FINANCE. Yearly finance dump is offline-only.',
    );
  }

  const cutoff = getFinanceRawTxCutoff(resolved.now());
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  if (yearEnd.getTime() > cutoff.getTime()) {
    throw new HttpError(
      400,
      `Finance year ${year} is inside the ${FINANCE_RAW_TX_RETENTION_MONTHS}-month raw retention window (cutoff ${cutoff.toISOString()}).`,
    );
  }

  await ensureArchiveDir(resolved.archiveDir);
  const query = buildFinanceYearArchiveQuery(year);
  const documentCount = await FinanceTransaction.countDocuments(query);

  const existing = await YearlyArchive.findOne({ kind: 'finance', year });
  if (existing?.status === 'completed' && existing.verified) {
    await ensureArchiveVerified(existing, resolved.archiveDir);
    if (existing.verified) {
      return {
        archive: formatYearlyArchive(existing.toObject() as YearlyArchiveDocument),
        created: false,
        message: 'Finance year already archived (offline cold copy).',
        deletedCount: 0,
      };
    }
  }

  const record =
    existing ??
    (await YearlyArchive.create({
      year,
      kind: 'finance',
      status: 'running',
      archiveFile: archiveFileName('finance', year),
      sizeBytes: 0,
      documentCount,
      prePurgeCount: documentCount,
      checksumSha256: '',
      verified: false,
      verifiedAt: null,
      deletedFromLive: false,
      author,
      error: '',
      query,
    }));

  try {
    if (documentCount === 0) {
      await markEmptyYearComplete(record, author, 0);
      return {
        archive: formatYearlyArchive(record.toObject() as YearlyArchiveDocument),
        created: true,
        message: 'No finance txs in year.',
        deletedCount: 0,
      };
    }

    const dump = await runCollectionDump('finance', year, query, resolved);
    record.status = 'completed';
    record.archiveFile = dump.fileName;
    record.sizeBytes = dump.sizeBytes;
    record.checksumSha256 = dump.checksumSha256;
    record.documentCount = documentCount;
    record.prePurgeCount = documentCount;
    record.verified = true;
    record.verifiedAt = new Date();
    record.error = '';
    record.author = author;
    record.deletedFromLive = false;

    await record.save();
    return {
      archive: formatYearlyArchive(record.toObject() as YearlyArchiveDocument),
      created: true,
      message: 'Finance year dump completed (offline-only).',
      deletedCount: 0,
    };
  } catch (error) {
    record.status = 'failed';
    record.verified = false;
    record.error = error instanceof Error ? error.message : 'Dump failed.';
    await record.save();
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, record.error);
  }
};

const dumpFileOk = async (record: YearlyArchiveDocument, archiveDir: string) => {
  if ((record.documentCount ?? 0) === 0) return true;
  try {
    await assertDumpFileUsable(path.join(archiveDir, record.archiveFile));
    return true;
  } catch {
    return false;
  }
};

export const runScheduledYearlyArchives = async (author = 'System') => {
  if (!env.archiveYearlyDumpsEnabled) {
    return { skipped: true as const, reason: 'disabled' };
  }

  const now = new Date();
  const archiveDir = path.join(env.backupDir, 'yearly');
  await ensureArchiveDir(archiveDir);
  const results: Array<Record<string, unknown>> = [];

  let safetyBackupDone = false;
  const withCycleSafety = async <T,>(fn: () => Promise<T>): Promise<T> => {
    // Safety backup is taken inside purge path; mark skip after first purge attempt in cycle via skip flag only if we already backed up.
    return fn();
  };

  for (const year of listEligibleSalesArchiveYears(now)) {
    try {
      await withCycleSafety(async () => {
        const existing = await YearlyArchive.findOne({ kind: 'sales', year });
        if (existing?.deletedFromLive) {
          return;
        }

        const fileOk =
          existing?.status === 'completed'
            ? await dumpFileOk(existing.toObject() as YearlyArchiveDocument, archiveDir)
            : false;

        if (existing?.status === 'completed' && existing.verified && fileOk) {
          if (env.archiveAutoPurgeSales && !existing.deletedFromLive) {
            const purgeResult = await purgeOnlySalesYear(year, author, {
              purge: true,
              skipSafetyBackup: safetyBackupDone,
            });
            if (!safetyBackupDone && env.archivePurgeRequireSafetyBackup) {
              safetyBackupDone = true;
            }
            results.push(purgeResult as unknown as Record<string, unknown>);
          }
          return;
        }

        // re-dump if missing / failed / unverified / file missing
        const hasDocs = await Sale.countDocuments(buildSalesYearArchiveQuery(year));
        if (hasDocs === 0 && existing?.status === 'completed' && existing.verified) {
          return;
        }
        if (hasDocs === 0 && !existing) {
          // optional: skip empty years in scheduler to avoid noise
          return;
        }

        results.push(
          (await createYearlySalesDump(year, author, {
            purge: env.archiveAutoPurgeSales,
            skipSafetyBackup: safetyBackupDone,
          })) as unknown as Record<string, unknown>,
        );
        if (env.archiveAutoPurgeSales && env.archivePurgeRequireSafetyBackup) {
          safetyBackupDone = true;
        }
      });
    } catch (error) {
      results.push({
        year,
        kind: 'sales',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const year of listEligibleFinanceArchiveYears(now)) {
    try {
      const existing = await YearlyArchive.findOne({ kind: 'finance', year });
      if (existing?.status === 'completed') {
        await ensureArchiveVerified(existing, archiveDir);
        const fileOk = await dumpFileOk(
          existing.toObject() as YearlyArchiveDocument,
          archiveDir,
        );
        if (existing.verified && fileOk) continue;
      }
      const hasDocs = await FinanceTransaction.countDocuments(
        buildFinanceYearArchiveQuery(year),
      );
      if (hasDocs === 0 && existing?.status === 'completed' && existing.verified) {
        continue;
      }
      if (hasDocs === 0 && !existing) continue;

      results.push(
        (await createYearlyFinanceDump(year, author, {
          purge: false,
        })) as unknown as Record<string, unknown>,
      );
    } catch (error) {
      results.push({
        year,
        kind: 'finance',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { skipped: false as const, results };
};
