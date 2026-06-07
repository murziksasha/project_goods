import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createManualBackup,
  createBackupId,
  createScheduledBackup,
  deleteBackup,
  deleteOldScheduledBackups,
  getBackupPaths,
  isSafeBackupId,
  listBackups,
  resetBackupJobForTests,
  restoreBackup,
  restoreBackupFromUploadedArchive,
} from './service';

const makeTempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'project-goods-backups-'));

const writeBackupPair = async (
  backupDir: string,
  backupId: string,
  options: {
    createdAt?: string;
    status?: 'completed' | 'failed' | 'running';
    type?: 'manual' | 'safety' | 'scheduled';
  } = {},
) => {
  const archiveFile = `${backupId}.archive.gz`;
  await fs.writeFile(path.join(backupDir, archiveFile), 'archive');
  await fs.writeFile(
    path.join(backupDir, `${backupId}.json`),
    JSON.stringify({
      id: backupId,
      createdAt: options.createdAt ?? '2026-06-07T10:00:00.000Z',
      updatedAt: options.createdAt ?? '2026-06-07T10:00:01.000Z',
      status: options.status ?? 'completed',
      type: options.type ?? 'manual',
      archiveFile,
      sizeBytes: 7,
      author: 'Owner',
      durationMs: 1000,
      error: '',
    }),
  );
};

afterEach(() => {
  resetBackupJobForTests();
});

describe('backup service', () => {
  it('generates and validates safe backup ids', () => {
    const id = createBackupId(new Date(2026, 5, 7, 8, 9, 10));

    expect(id).toBe('project-goods-20260607-080910');
    expect(isSafeBackupId(id)).toBe(true);
    expect(isSafeBackupId('../project-goods-20260607-080910')).toBe(false);
    expect(() => getBackupPaths('../bad')).toThrow('Invalid backup id.');
  });

  it('lists only valid backup metadata with existing archives', async () => {
    const backupDir = await makeTempDir();
    const backupId = 'project-goods-20260607-100000';
    await writeBackupPair(backupDir, backupId);
    await fs.writeFile(path.join(backupDir, 'bad.json'), '{');
    await fs.writeFile(
      path.join(backupDir, 'project-goods-20260607-100001.json'),
      JSON.stringify({
        id: 'project-goods-20260607-100001',
        createdAt: '2026-06-07T10:00:01.000Z',
        updatedAt: '2026-06-07T10:00:01.000Z',
        status: 'completed',
        archiveFile: 'missing.archive.gz',
      }),
    );

    await expect(listBackups({ backupDir })).resolves.toMatchObject([
      {
        id: backupId,
        status: 'completed',
        sizeBytes: 7,
      },
    ]);
  });

  it('creates a completed backup and writes metadata', async () => {
    const backupDir = await makeTempDir();
    const nowValues = [
      new Date(2026, 5, 7, 10, 0, 0),
      new Date(2026, 5, 7, 10, 0, 2),
    ];
    const result = await createManualBackup('Owner', {
      backupDir,
      mongoUri: 'mongodb://localhost/test',
      now: () => nowValues.shift() ?? new Date(2026, 5, 7, 10, 0, 2),
      runCommand: async (_command, args) => {
        const archiveArg = args.find((arg) => arg.startsWith('--archive='));
        if (!archiveArg) throw new Error('archive arg missing');
        await fs.writeFile(archiveArg.replace('--archive=', ''), 'archive');
      },
    });

    expect(result).toMatchObject({
      id: 'project-goods-20260607-100000',
      status: 'completed',
      author: 'Owner',
      durationMs: 2000,
      sizeBytes: 7,
    });
    await expect(listBackups({ backupDir })).resolves.toHaveLength(1);
  });

  it('creates scheduled backups with a scheduled type', async () => {
    const backupDir = await makeTempDir();
    const nowValues = [
      new Date(2026, 5, 7, 15, 0, 0),
      new Date(2026, 5, 7, 15, 0, 1),
    ];
    const result = await createScheduledBackup('System', {
      backupDir,
      now: () => nowValues.shift() ?? new Date(2026, 5, 7, 15, 0, 1),
      runCommand: async (_command, args) => {
        const archiveArg = args.find((arg) => arg.startsWith('--archive='));
        if (!archiveArg) throw new Error('archive arg missing');
        await fs.writeFile(archiveArg.replace('--archive=', ''), 'archive');
      },
    });

    expect(result).toMatchObject({
      id: 'project-goods-20260607-150000-scheduled',
      type: 'scheduled',
      status: 'completed',
      author: 'System',
    });
  });

  it('keeps failed backup metadata visible when archive was not created', async () => {
    const backupDir = await makeTempDir();
    const result = await createManualBackup('Owner', {
      backupDir,
      runCommand: async () => {
        throw new Error('mongodump was not found.');
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: 'mongodump was not found.',
      sizeBytes: 0,
    });
    await expect(listBackups({ backupDir })).resolves.toMatchObject([
      {
        id: result.id,
        status: 'failed',
        error: 'mongodump was not found.',
      },
    ]);
  });

  it('blocks a second job while one is running', async () => {
    const backupDir = await makeTempDir();
    let releaseCommand: (() => void) | undefined;
    const firstJob = createManualBackup('Owner', {
      backupDir,
      runCommand: async (_command, args) => {
        const archiveArg = args.find((arg) => arg.startsWith('--archive='));
        if (archiveArg) {
          await fs.writeFile(archiveArg.replace('--archive=', ''), 'archive');
        }
        await new Promise<void>((resolve) => {
          releaseCommand = resolve;
        });
      },
    });
    while (!releaseCommand) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    await expect(createManualBackup('Owner', { backupDir })).rejects.toThrow(
      'Backup create operation is already running.',
    );

    releaseCommand?.();
    await firstJob;
  });

  it('requires an exact restore confirmation phrase', async () => {
    const backupDir = await makeTempDir();
    await writeBackupPair(backupDir, 'project-goods-20260607-100000');

    await expect(
      restoreBackup(
        'project-goods-20260607-100000',
        'restore',
        'Owner',
        { backupDir },
      ),
    ).rejects.toThrow('Restore confirmation phrase is invalid.');
  });

  it('deletes a completed backup archive and metadata', async () => {
    const backupDir = await makeTempDir();
    const backupId = 'project-goods-20260607-100000';
    await writeBackupPair(backupDir, backupId);

    await expect(deleteBackup(backupId, { backupDir })).resolves.toEqual({
      id: backupId,
      deleted: true,
    });
    await expect(fs.access(path.join(backupDir, `${backupId}.archive.gz`))).rejects.toThrow();
    await expect(fs.access(path.join(backupDir, `${backupId}.json`))).rejects.toThrow();
  });

  it('rejects invalid backup ids during delete', async () => {
    const backupDir = await makeTempDir();

    await expect(deleteBackup('../bad', { backupDir })).rejects.toThrow(
      'Invalid backup id.',
    );
  });

  it('does not delete a running backup', async () => {
    const backupDir = await makeTempDir();
    const backupId = 'project-goods-20260607-100000';
    await writeBackupPair(backupDir, backupId, { status: 'running' });

    await expect(deleteBackup(backupId, { backupDir })).rejects.toThrow(
      'Running backup cannot be deleted.',
    );
    await expect(fs.access(path.join(backupDir, `${backupId}.json`))).resolves.toBeUndefined();
  });

  it('deletes only scheduled backups older than the retention window', async () => {
    const backupDir = await makeTempDir();
    const oldScheduledId = 'project-goods-20260501-150000-scheduled';
    const recentScheduledId = 'project-goods-20260601-150000-scheduled';
    const oldManualId = 'project-goods-20260501-150000';
    const oldSafetyId = 'project-goods-20260501-150000-safety';
    await writeBackupPair(backupDir, oldScheduledId, {
      createdAt: '2026-05-01T15:00:00.000Z',
      type: 'scheduled',
    });
    await writeBackupPair(backupDir, recentScheduledId, {
      createdAt: '2026-06-01T15:00:00.000Z',
      type: 'scheduled',
    });
    await writeBackupPair(backupDir, oldManualId, {
      createdAt: '2026-05-01T15:00:00.000Z',
      type: 'manual',
    });
    await writeBackupPair(backupDir, oldSafetyId, {
      createdAt: '2026-05-01T15:00:00.000Z',
      type: 'safety',
    });

    await expect(
      deleteOldScheduledBackups(14, {
        backupDir,
        now: () => new Date('2026-06-07T15:00:00.000Z'),
      }),
    ).resolves.toEqual([oldScheduledId]);

    await expect(listBackups({ backupDir })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: recentScheduledId }),
        expect.objectContaining({ id: oldManualId }),
        expect.objectContaining({ id: oldSafetyId }),
      ]),
    );
    await expect(fs.access(path.join(backupDir, `${oldScheduledId}.json`))).rejects.toThrow();
  });

  it('creates a safety backup before restore', async () => {
    const backupDir = await makeTempDir();
    await writeBackupPair(backupDir, 'project-goods-20260607-100000');
    const nowValues = [
      new Date(2026, 5, 7, 10, 1, 0),
      new Date(2026, 5, 7, 10, 1, 1),
    ];
    const commands: string[] = [];

    const result = await restoreBackup(
      'project-goods-20260607-100000',
      'RESTORE',
      'Owner',
      {
        backupDir,
        now: () => nowValues.shift() ?? new Date(2026, 5, 7, 10, 1, 1),
        runCommand: async (command, args) => {
          commands.push(command);
          const archiveArg = args.find((arg) => arg.startsWith('--archive='));
          if (command === 'mongodump' && archiveArg) {
            await fs.writeFile(archiveArg.replace('--archive=', ''), 'safety');
          }
        },
      },
    );

    expect(result).toEqual({
      restoredBackupId: 'project-goods-20260607-100000',
      safetyBackupId: 'project-goods-20260607-100100-safety',
      success: true,
    });
    expect(commands).toEqual(['mongodump', 'mongorestore']);
  });

  it('restores from an uploaded archive and removes the temporary file', async () => {
    const backupDir = await makeTempDir();
    const nowValues = [
      new Date(2026, 5, 7, 10, 2, 0),
      new Date(2026, 5, 7, 10, 2, 1),
    ];
    const restoreArchivePaths: string[] = [];

    const result = await restoreBackupFromUploadedArchive(
      Buffer.from('uploaded-archive'),
      'downloaded.archive.gz',
      'RESTORE',
      'Owner',
      {
        backupDir,
        now: () => nowValues.shift() ?? new Date(2026, 5, 7, 10, 2, 1),
        runCommand: async (command, args) => {
          const archiveArg = args.find((arg) => arg.startsWith('--archive='));
          if (!archiveArg) throw new Error('archive arg missing');
          const archivePath = archiveArg.replace('--archive=', '');
          if (command === 'mongodump') {
            await fs.writeFile(archivePath, 'safety');
          }
          if (command === 'mongorestore') {
            restoreArchivePaths.push(archivePath);
            await expect(fs.readFile(archivePath, 'utf8')).resolves.toBe(
              'uploaded-archive',
            );
          }
        },
      },
    );

    expect(result).toEqual({
      restoredArchiveFile: 'downloaded.archive.gz',
      safetyBackupId: 'project-goods-20260607-100200-safety',
      success: true,
    });
    expect(restoreArchivePaths).toHaveLength(1);
    await expect(fs.access(restoreArchivePaths[0]!)).rejects.toThrow();
    const entries = await fs.readdir(backupDir);
    expect(entries.some((entry) => entry.startsWith('.restore-'))).toBe(false);
  });

  it('requires confirmation before restoring an uploaded archive', async () => {
    const backupDir = await makeTempDir();
    const commands: string[] = [];

    await expect(
      restoreBackupFromUploadedArchive(
        Buffer.from('uploaded-archive'),
        'downloaded.archive.gz',
        'restore',
        'Owner',
        {
          backupDir,
          runCommand: async (command) => {
            commands.push(command);
          },
        },
      ),
    ).rejects.toThrow('Restore confirmation phrase is invalid.');
    expect(commands).toEqual([]);
  });

  it('blocks uploaded archive restore while another job is running', async () => {
    const backupDir = await makeTempDir();
    let releaseCommand: (() => void) | undefined;
    const firstJob = createManualBackup('Owner', {
      backupDir,
      runCommand: async (_command, args) => {
        const archiveArg = args.find((arg) => arg.startsWith('--archive='));
        if (archiveArg) {
          await fs.writeFile(archiveArg.replace('--archive=', ''), 'archive');
        }
        await new Promise<void>((resolve) => {
          releaseCommand = resolve;
        });
      },
    });
    while (!releaseCommand) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    await expect(
      restoreBackupFromUploadedArchive(
        Buffer.from('uploaded-archive'),
        'downloaded.archive.gz',
        'RESTORE',
        'Owner',
        { backupDir },
      ),
    ).rejects.toThrow('Backup create operation is already running.');

    releaseCommand?.();
    await firstJob;
  });
});
