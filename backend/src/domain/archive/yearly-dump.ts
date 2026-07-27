import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';
import { HttpError } from '../../shared/lib/errors';
import { Sale } from '../sale/model';
import { FinanceTransaction } from '../finance/model';
import {
  YearlyArchive,
  type YearlyArchiveDocument,
  type YearlyArchiveKind,
} from './model';

/** Live sales older than this many months are eligible for yearly offline dump. */
export const SALES_HOT_MONTHS = 24;

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
};

const getOptions = (options: YearlyDumpOptions = {}) => ({
  archiveDir: options.archiveDir ?? path.join(env.backupDir, 'yearly'),
  mongoUri: options.mongoUri ?? env.mongoUri,
  runCommand: options.runCommand ?? defaultRunCommand,
  now: options.now ?? (() => new Date()),
  purge: options.purge ?? false,
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

const ensureArchiveDir = async (archiveDir: string) => {
  await fs.mkdir(archiveDir, { recursive: true });
};

const archiveFileName = (kind: YearlyArchiveKind, year: number) =>
  `project-goods-${kind}-${year}.archive.gz`;

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
  return { fileName, archivePath, sizeBytes: stats.size };
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

  const record =
    existing ??
    (await YearlyArchive.create({
      year,
      kind: 'sales',
      status: 'running',
      archiveFile: archiveFileName('sales', year),
      sizeBytes: 0,
      documentCount,
      deletedFromLive: false,
      author,
      error: '',
      query,
    }));

  try {
    if (documentCount === 0) {
      record.status = 'completed';
      record.documentCount = 0;
      record.sizeBytes = 0;
      record.error = '';
      record.author = author;
      await record.save();
      return {
        archive: formatYearlyArchive(record.toObject() as YearlyArchiveDocument),
        created: true,
        message: 'No terminal sales in year; marked complete.',
        deletedCount: 0,
      };
    }

    const dump = await runCollectionDump('sales', year, query, resolved);
    record.status = 'completed';
    record.archiveFile = dump.fileName;
    record.sizeBytes = dump.sizeBytes;
    record.documentCount = documentCount;
    record.error = '';
    record.author = author;

    let deletedCount = 0;
    if (resolved.purge || env.archiveAutoPurgeSales) {
      const deleted = await Sale.deleteMany(query);
      deletedCount = deleted.deletedCount ?? 0;
      record.deletedFromLive = deletedCount > 0;
    }

    await record.save();
    return {
      archive: formatYearlyArchive(record.toObject() as YearlyArchiveDocument),
      created: true,
      message: 'Sales year dump completed.',
      deletedCount,
    };
  } catch (error) {
    record.status = 'failed';
    record.error = error instanceof Error ? error.message : 'Dump failed.';
    await record.save();
    throw new HttpError(500, record.error);
  }
};

export const createYearlyFinanceDump = async (
  year: number,
  author: string,
  options: YearlyDumpOptions = {},
) => {
  const resolved = getOptions(options);
  const cutoffYear = resolved.now().getUTCFullYear() - 2;
  if (year >= cutoffYear) {
    throw new HttpError(
      400,
      `Finance year ${year} is inside the 2-year raw retention window (cutoff year ${cutoffYear}).`,
    );
  }

  await ensureArchiveDir(resolved.archiveDir);
  const query = buildFinanceYearArchiveQuery(year);
  const documentCount = await FinanceTransaction.countDocuments(query);

  const existing = await YearlyArchive.findOne({ kind: 'finance', year });
  if (existing?.status === 'completed' && existing.deletedFromLive) {
    return {
      archive: formatYearlyArchive(existing.toObject() as YearlyArchiveDocument),
      created: false,
      message: 'Finance year already archived and purged.',
    };
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
      deletedFromLive: false,
      author,
      error: '',
      query,
    }));

  try {
    if (documentCount === 0) {
      record.status = 'completed';
      record.documentCount = 0;
      record.error = '';
      await record.save();
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
    record.documentCount = documentCount;
    record.error = '';
    record.author = author;

    // Finance live purge goes through period-snapshot seal (safer ledger invariant).
    // Yearly dump is offline cold copy only unless explicit purge flag.
    let deletedCount = 0;
    if (resolved.purge) {
      const deleted = await FinanceTransaction.deleteMany(query);
      deletedCount = deleted.deletedCount ?? 0;
      record.deletedFromLive = deletedCount > 0;
    }

    await record.save();
    return {
      archive: formatYearlyArchive(record.toObject() as YearlyArchiveDocument),
      created: true,
      message: 'Finance year dump completed.',
      deletedCount,
    };
  } catch (error) {
    record.status = 'failed';
    record.error = error instanceof Error ? error.message : 'Dump failed.';
    await record.save();
    throw new HttpError(500, record.error);
  }
};

export const runScheduledYearlyArchives = async (author = 'System') => {
  if (!env.archiveYearlyDumpsEnabled) {
    return { skipped: true as const, reason: 'disabled' };
  }

  const now = new Date();
  const results: Array<Record<string, unknown>> = [];

  for (const year of listEligibleSalesArchiveYears(now)) {
    const existing = await YearlyArchive.findOne({ kind: 'sales', year, status: 'completed' });
    if (existing) continue;
    const hasDocs = await Sale.countDocuments(buildSalesYearArchiveQuery(year));
    if (hasDocs === 0) continue;
    try {
      results.push(await createYearlySalesDump(year, author, { purge: env.archiveAutoPurgeSales }));
    } catch (error) {
      results.push({
        year,
        kind: 'sales',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { skipped: false as const, results };
};
