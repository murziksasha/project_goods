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

export type RestoreBackupResult = {
  restoredBackupId: string;
  safetyBackupId: string;
  success: boolean;
};

export type RestoreBackupFromFileResult = {
  restoredArchiveFile: string;
  safetyBackupId: string;
  success: boolean;
};

export type DeleteBackupResult = {
  id: string;
  deleted: true;
};
