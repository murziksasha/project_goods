import { spawn } from 'child_process';
import fs from 'fs/promises';
import mongoose from 'mongoose';
import path from 'path';
import { env } from '../../config/env';
import { HttpError } from '../../shared/lib/errors';

const backupIdPattern = /^project-goods-\d{8}-\d{6}(?:-(?:safety|scheduled))?$/;
const archiveSuffix = '.archive.gz';
const metadataSuffix = '.json';
const restoreConfirmation = 'RESTORE';

export type BackupStatus = 'completed' | 'failed' | 'running';
export type BackupType = 'manual' | 'safety' | 'scheduled';

export type BackupMetadata = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: BackupStatus;
  type: BackupType;
  archiveFile: string;
  sizeBytes: number;
  author: string;
  durationMs: number;
  error: string;
};

type CommandContext = {
  mongoUri: string;
  archivePath: string;
};

type CommandRunner = (command: string, args: string[]) => Promise<void>;
type DatabaseClearer = (mongoUri: string) => Promise<void>;

type BackupServiceOptions = {
  backupDir?: string;
  mongoUri?: string;
  createCommand?: string;
  restoreCommand?: string;
  runCommand?: CommandRunner;
  clearDatabase?: DatabaseClearer;
  now?: () => Date;
};

type ActiveJob = {
  type: 'create' | 'restore' | 'scheduled';
  startedAt: Date;
};

let activeJob: ActiveJob | null = null;

const defaultRunCommand: CommandRunner = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false });
    let stderr = '';

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(
          new Error(
            `${command} was not found. Install MongoDB Database Tools on the backend host or configure BACKUP_CREATE_COMMAND/BACKUP_RESTORE_COMMAND.`,
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

/** Dangerous shell metacharacters — custom backup templates must not include these. */
const BACKUP_SHELL_UNSAFE = /[;&|`$<>\\!\n\r]/

/**
 * Validate custom BACKUP_*_COMMAND templates before shell execution.
 * Only `{mongoUri}` and `{archivePath}` placeholders are expanded.
 */
export const assertSafeBackupCommandTemplate = (template: string, label: string) => {
  const trimmed = template.trim();
  if (!trimmed) {
    throw new HttpError(500, `${label} is empty.`);
  }
  if (BACKUP_SHELL_UNSAFE.test(trimmed)) {
    throw new HttpError(
      500,
      `${label} contains disallowed shell characters. Use only {mongoUri} and {archivePath} placeholders.`,
    );
  }
  // After stripping known placeholders, reject any remaining braces (unexpected expansion).
  const withoutPlaceholders = trimmed
    .replaceAll('{mongoUri}', '')
    .replaceAll('{archivePath}', '');
  if (withoutPlaceholders.includes('{') || withoutPlaceholders.includes('}')) {
    throw new HttpError(
      500,
      `${label} has unknown placeholders. Only {mongoUri} and {archivePath} are allowed.`,
    );
  }
};

const runShellCommand = (template: string, context: CommandContext) =>
  new Promise<void>((resolve, reject) => {
    assertSafeBackupCommandTemplate(template, 'Backup command');
    const command = template
      .replaceAll('{mongoUri}', context.mongoUri)
      .replaceAll('{archivePath}', context.archivePath);
    // Re-check expansion result for injection via path/uri content (should already be trusted env).
    if (BACKUP_SHELL_UNSAFE.test(command.replaceAll(context.mongoUri, '').replaceAll(context.archivePath, ''))) {
      reject(new Error('Expanded backup command failed safety check.'));
      return;
    }
    const child = spawn(command, { shell: true });
    let stderr = '';

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `Backup command exited with code ${code}`));
    });
  });

const clearMongoDatabase: DatabaseClearer = async (mongoUri) => {
  const connection = mongoose.createConnection(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await connection.asPromise();
    const db = connection.db;
    if (!db) {
      throw new HttpError(500, 'MongoDB database connection was not initialized.');
    }
    const collections = await db.listCollections().toArray();
    await Promise.all(
      collections.map((collection) =>
        db.dropCollection(collection.name),
      ),
    );
  } finally {
    await connection.close().catch(() => undefined);
  }
};

export const isSafeBackupId = (backupId: string) => backupIdPattern.test(backupId);

const formatTimestamp = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
};

export const createBackupId = (date = new Date(), type: BackupType = 'manual') => {
  const suffix = type === 'manual' ? '' : `-${type}`;
  return `project-goods-${formatTimestamp(date)}${suffix}`;
};

const getOptions = (options: BackupServiceOptions = {}) => ({
  backupDir: options.backupDir ?? env.backupDir,
  mongoUri: options.mongoUri ?? env.mongoUri,
  createCommand: options.createCommand ?? env.backupCreateCommand,
  restoreCommand: options.restoreCommand ?? env.backupRestoreCommand,
  runCommand: options.runCommand ?? defaultRunCommand,
  clearDatabase: options.clearDatabase ?? clearMongoDatabase,
  now: options.now ?? (() => new Date()),
});

const ensureBackupDir = async (backupDir: string) => {
  await fs.mkdir(backupDir, { recursive: true });
};

const getArchiveFile = (backupId: string) => `${backupId}${archiveSuffix}`;
const getMetadataFile = (backupId: string) => `${backupId}${metadataSuffix}`;

/**
 * Accepts `*.archive.gz` and Windows download renames like `*.archive (1).gz`.
 * Returns a safe basename ending in `.archive.gz`, or empty when invalid.
 * Handles full Windows paths even when running on Linux CI.
 */
export const getUploadedArchiveName = (archiveFileName: string) => {
  // Normalize separators so path.basename works for Windows paths on POSIX CI
  const baseName = path.basename(archiveFileName.replace(/\\/g, '/')).trim();
  if (!baseName) {
    return '';
  }

  // Chrome/Edge/Windows: "file.archive.gz" → "file.archive (1).gz" on re-download
  const windowsDuplicate = baseName.match(/^(.+\.archive)\s+\(\d+\)\.gz$/i);
  if (windowsDuplicate?.[1]) {
    return `${windowsDuplicate[1]}.gz`;
<<<<<<< HEAD
  }

  if (!baseName.endsWith(archiveSuffix)) {
    return '';
=======
>>>>>>> 4bbc596026bef77baea552e14768a1b5cd529079
  }

  return baseName;
};

export const getBackupPaths = (backupId: string, backupDir = env.backupDir) => {
  if (!isSafeBackupId(backupId)) {
    throw new HttpError(400, 'Invalid backup id.');
  }

  return {
    archivePath: path.join(backupDir, getArchiveFile(backupId)),
    metadataPath: path.join(backupDir, getMetadataFile(backupId)),
  };
};

const readMetadata = async (metadataPath: string) => {
  const rawValue = await fs.readFile(metadataPath, 'utf8');
  const parsed = JSON.parse(rawValue) as Partial<BackupMetadata>;

  if (
    !parsed.id ||
    !isSafeBackupId(parsed.id) ||
    !parsed.createdAt ||
    !parsed.updatedAt ||
    !parsed.archiveFile ||
    !parsed.status
  ) {
    throw new HttpError(500, 'Invalid backup metadata.');
  }

  const backupId = parsed.id;
  const inferBackupType = (): BackupType => {
    if (parsed.type === 'safety' || parsed.type === 'scheduled') {
      return parsed.type;
    }
    if (backupId.endsWith('-scheduled')) return 'scheduled';
    if (backupId.endsWith('-safety')) return 'safety';
    return 'manual';
  };

  return {
    id: parsed.id,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    status: parsed.status,
    type: inferBackupType(),
    archiveFile: parsed.archiveFile,
    sizeBytes: Number(parsed.sizeBytes ?? 0),
    author: String(parsed.author ?? ''),
    durationMs: Number(parsed.durationMs ?? 0),
    error: String(parsed.error ?? ''),
  } satisfies BackupMetadata;
};

const writeMetadata = async (backupDir: string, metadata: BackupMetadata) => {
  await fs.writeFile(
    path.join(backupDir, getMetadataFile(metadata.id)),
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8',
  );
};

export const listBackups = async (options: BackupServiceOptions = {}) => {
  const { backupDir } = getOptions(options);
  await ensureBackupDir(backupDir);

  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  const backups = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(metadataSuffix))
      .map(async (entry) => {
        try {
          const metadata = await readMetadata(path.join(backupDir, entry.name));
          const archivePath = path.join(backupDir, metadata.archiveFile);
          const archiveStats =
            metadata.status === 'completed'
              ? await fs.stat(archivePath)
              : { size: metadata.sizeBytes };
          return {
            ...metadata,
            sizeBytes: archiveStats.size,
          };
        } catch {
          return null;
        }
      }),
  );

  return backups
    .filter((backup): backup is BackupMetadata => backup !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

const runCreateCommand = async (
  archivePath: string,
  options: ReturnType<typeof getOptions>,
) => {
  if (options.createCommand) {
    await runShellCommand(options.createCommand, {
      mongoUri: options.mongoUri,
      archivePath,
    });
    return;
  }

  await options.runCommand('mongodump', [
    '--uri',
    options.mongoUri,
    `--archive=${archivePath}`,
    '--gzip',
  ]);
};

const runRestoreCommand = async (
  archivePath: string,
  options: ReturnType<typeof getOptions>,
) => {
  if (options.restoreCommand) {
    await runShellCommand(options.restoreCommand, {
      mongoUri: options.mongoUri,
      archivePath,
    });
    return;
  }

  await options.runCommand('mongorestore', [
    '--uri',
    options.mongoUri,
    `--archive=${archivePath}`,
    '--gzip',
    '--drop',
  ]);
};

const assertNoActiveJob = () => {
  if (!activeJob) return;
  throw new HttpError(
    409,
    `Backup ${activeJob.type} operation is already running.`,
  );
};

const createBackup = async (
  author: string,
  type: BackupType,
  options: BackupServiceOptions,
) => {
  const resolvedOptions = getOptions(options);
  await ensureBackupDir(resolvedOptions.backupDir);

  const startedAt = resolvedOptions.now();
  const backupId = createBackupId(startedAt, type);
  const archiveFile = getArchiveFile(backupId);
  const { archivePath } = getBackupPaths(backupId, resolvedOptions.backupDir);
  const baseMetadata: BackupMetadata = {
    id: backupId,
    createdAt: startedAt.toISOString(),
    updatedAt: startedAt.toISOString(),
    status: 'running',
    type,
    archiveFile,
    sizeBytes: 0,
    author,
    durationMs: 0,
    error: '',
  };

  await writeMetadata(resolvedOptions.backupDir, baseMetadata);

  try {
    await runCreateCommand(archivePath, resolvedOptions);
    const finishedAt = resolvedOptions.now();
    const stats = await fs.stat(archivePath);
    const metadata = {
      ...baseMetadata,
      status: 'completed' as const,
      updatedAt: finishedAt.toISOString(),
      sizeBytes: stats.size,
      durationMs: Math.max(finishedAt.getTime() - startedAt.getTime(), 0),
    };
    await writeMetadata(resolvedOptions.backupDir, metadata);
    // Disk policy after successful create (age / count / size). Failures are non-fatal.
    try {
      await enforceBackupRetention(getDefaultBackupRetentionPolicy(), {
        backupDir: resolvedOptions.backupDir,
        now: resolvedOptions.now,
      });
    } catch (retentionError) {
      console.error('Backup retention failed after create:', retentionError);
    }
    return metadata;
  } catch (error) {
    const finishedAt = resolvedOptions.now();
    const metadata = {
      ...baseMetadata,
      status: 'failed' as const,
      updatedAt: finishedAt.toISOString(),
      durationMs: Math.max(finishedAt.getTime() - startedAt.getTime(), 0),
      error: error instanceof Error ? error.message : 'Backup failed.',
    };
    await writeMetadata(resolvedOptions.backupDir, metadata);
    return metadata;
  }
};

export const createManualBackup = async (
  author: string,
  options: BackupServiceOptions = {},
) => {
  assertNoActiveJob();
  activeJob = { type: 'create', startedAt: new Date() };

  try {
    return await createBackup(author, 'manual', options);
  } finally {
    activeJob = null;
  }
};

export const createSafetyBackup = async (
  author: string,
  options: BackupServiceOptions = {},
) => {
  assertNoActiveJob();
  activeJob = { type: 'create', startedAt: new Date() };

  try {
    return await createBackup(author, 'safety', options);
  } finally {
    activeJob = null;
  }
};

export const createScheduledBackup = async (
  author = 'System',
  options: BackupServiceOptions = {},
) => {
  assertNoActiveJob();
  activeJob = { type: 'scheduled', startedAt: new Date() };

  try {
    return await createBackup(author, 'scheduled', options);
  } finally {
    activeJob = null;
  }
};

export const getBackupArchive = async (
  backupId: string,
  options: BackupServiceOptions = {},
) => {
  const { backupDir } = getOptions(options);
  const backup = (await listBackups({ backupDir })).find(
    (item) => item.id === backupId,
  );

  if (!backup || backup.status !== 'completed') {
    throw new HttpError(404, 'Backup archive not found.');
  }

  const { archivePath } = getBackupPaths(backupId, backupDir);
  await fs.access(archivePath);

  return {
    path: archivePath,
    fileName: backup.archiveFile,
  };
};

export const deleteBackup = async (
  backupId: string,
  options: BackupServiceOptions = {},
) => {
  const { backupDir } = getOptions(options);
  const { archivePath, metadataPath } = getBackupPaths(backupId, backupDir);
  const backup = (await listBackups({ backupDir })).find(
    (item) => item.id === backupId,
  );

  if (!backup) {
    throw new HttpError(404, 'Backup archive not found.');
  }

  if (backup.status === 'running') {
    throw new HttpError(409, 'Running backup cannot be deleted.');
  }

  await Promise.all([
    fs.rm(archivePath, { force: true }),
    fs.rm(metadataPath, { force: true }),
  ]);

  return { id: backupId, deleted: true };
};

export type BackupRetentionPolicy = {
  scheduledRetentionDays: number;
  scheduledMaxCount: number;
  safetyMaxCount: number;
  /** 0 = disabled. */
  maxTotalBytes: number;
};

export const getDefaultBackupRetentionPolicy = (): BackupRetentionPolicy => ({
  scheduledRetentionDays: env.backupScheduledRetentionDays,
  scheduledMaxCount: env.backupScheduledMaxCount,
  safetyMaxCount: env.backupSafetyMaxCount,
  maxTotalBytes: env.backupMaxTotalBytes,
});

const sortOldestFirst = (backups: BackupMetadata[]) =>
  [...backups].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

/**
 * Enforce backup disk policy:
 * 1) age-based scheduled prune
 * 2) max count for scheduled / safety
 * 3) optional total size cap (drops oldest scheduled, then safety; never auto-deletes manual)
 */
export const enforceBackupRetention = async (
  policy: BackupRetentionPolicy = getDefaultBackupRetentionPolicy(),
  options: BackupServiceOptions = {},
) => {
  const { backupDir, now } = getOptions(options);
  const deletedIds: string[] = [];
  const deleteOne = async (backupId: string) => {
    if (deletedIds.includes(backupId)) return;
    await deleteBackup(backupId, { backupDir });
    deletedIds.push(backupId);
  };

  let backups = await listBackups({ backupDir });

  if (policy.scheduledRetentionDays > 0) {
    const cutoffTime =
      now().getTime() - policy.scheduledRetentionDays * 24 * 60 * 60 * 1000;
    const expiredScheduled = backups.filter((backup) => {
      if (backup.type !== 'scheduled' || backup.status === 'running') return false;
      const createdAt = new Date(backup.createdAt).getTime();
      return Number.isFinite(createdAt) && createdAt < cutoffTime;
    });
    for (const backup of expiredScheduled) {
      await deleteOne(backup.id);
    }
    if (expiredScheduled.length > 0) {
      backups = await listBackups({ backupDir });
    }
  }

  const pruneByMaxCount = async (type: BackupType, maxCount: number) => {
    if (maxCount <= 0) return;
    const candidates = sortOldestFirst(
      backups.filter(
        (backup) =>
          backup.type === type &&
          backup.status !== 'running' &&
          !deletedIds.includes(backup.id),
      ),
    );
    const excess = candidates.length - maxCount;
    if (excess <= 0) return;
    for (const backup of candidates.slice(0, excess)) {
      await deleteOne(backup.id);
    }
  };

  await pruneByMaxCount('scheduled', policy.scheduledMaxCount);
  await pruneByMaxCount('safety', policy.safetyMaxCount);

  if (policy.maxTotalBytes > 0) {
    backups = await listBackups({ backupDir });
    const completed = backups.filter(
      (backup) => backup.status === 'completed' && !deletedIds.includes(backup.id),
    );
    let totalBytes = completed.reduce((sum, backup) => sum + backup.sizeBytes, 0);

    const dropOrder = [
      ...sortOldestFirst(completed.filter((backup) => backup.type === 'scheduled')),
      ...sortOldestFirst(completed.filter((backup) => backup.type === 'safety')),
    ];

    for (const backup of dropOrder) {
      if (totalBytes <= policy.maxTotalBytes) break;
      await deleteOne(backup.id);
      totalBytes -= backup.sizeBytes;
    }
  }

  return deletedIds;
};

/** @deprecated Prefer enforceBackupRetention; kept for callers/tests. */
export const deleteOldScheduledBackups = async (
  maxAgeDays: number,
  options: BackupServiceOptions = {},
) =>
  enforceBackupRetention(
    {
      ...getDefaultBackupRetentionPolicy(),
      scheduledRetentionDays: maxAgeDays,
      // Age-only mode: do not also apply count/size defaults from env for this helper.
      scheduledMaxCount: Number.MAX_SAFE_INTEGER,
      safetyMaxCount: Number.MAX_SAFE_INTEGER,
      maxTotalBytes: 0,
    },
    options,
  );

export const restoreBackup = async (
  backupId: string,
  confirmation: unknown,
  author: string,
  options: BackupServiceOptions = {},
) => {
  if (String(confirmation ?? '') !== restoreConfirmation) {
    throw new HttpError(400, 'Restore confirmation phrase is invalid.');
  }

  assertNoActiveJob();
  activeJob = { type: 'restore', startedAt: new Date() };

  try {
    const resolvedOptions = getOptions(options);
    const backup = (await listBackups({ backupDir: resolvedOptions.backupDir })).find(
      (item) => item.id === backupId,
    );
    if (!backup || backup.status !== 'completed') {
      throw new HttpError(404, 'Backup archive not found.');
    }

    const { archivePath } = getBackupPaths(backupId, resolvedOptions.backupDir);
    await fs.access(archivePath);
    const safetyBackup = await createBackup(author, 'safety', options);
    if (safetyBackup.status !== 'completed') {
      throw new HttpError(500, 'Safety backup failed. Restore was not started.');
    }

    await resolvedOptions.clearDatabase(resolvedOptions.mongoUri);
    await runRestoreCommand(archivePath, resolvedOptions);

    return {
      restoredBackupId: backupId,
      safetyBackupId: safetyBackup.id,
      success: true,
    };
  } finally {
    activeJob = null;
  }
};

export const restoreBackupFromUploadedArchive = async (
  archiveBuffer: Buffer,
  archiveFileName: string,
  confirmation: unknown,
  author: string,
  options: BackupServiceOptions = {},
) => {
  if (String(confirmation ?? '') !== restoreConfirmation) {
    throw new HttpError(400, 'Restore confirmation phrase is invalid.');
  }

  const restoredArchiveFile = getUploadedArchiveName(archiveFileName);
  if (!restoredArchiveFile) {
    throw new HttpError(400, 'Backup archive file must end with .archive.gz.');
  }

  if (archiveBuffer.length === 0) {
    throw new HttpError(400, 'Backup archive file is empty.');
  }

  assertNoActiveJob();
  activeJob = { type: 'restore', startedAt: new Date() };

  let tempDir = '';
  try {
    const resolvedOptions = getOptions(options);
    await ensureBackupDir(resolvedOptions.backupDir);
    tempDir = await fs.mkdtemp(path.join(resolvedOptions.backupDir, '.restore-'));
    const archivePath = path.join(tempDir, restoredArchiveFile);
    await fs.writeFile(archivePath, archiveBuffer);

    const safetyBackup = await createBackup(author, 'safety', options);
    if (safetyBackup.status !== 'completed') {
      throw new HttpError(500, 'Safety backup failed. Restore was not started.');
    }

    await resolvedOptions.clearDatabase(resolvedOptions.mongoUri);
    await runRestoreCommand(archivePath, resolvedOptions);

    return {
      restoredArchiveFile,
      safetyBackupId: safetyBackup.id,
      success: true,
    };
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    activeJob = null;
  }
};

export const resetBackupJobForTests = () => {
  activeJob = null;
};
