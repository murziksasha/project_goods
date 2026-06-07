import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type {
  BackupMetadata,
  DeleteBackupResult,
  RestoreBackupFromFileResult,
  RestoreBackupResult,
} from '../model/types';

export const listBackups = async () => {
  try {
    const response = await apiClient.get<BackupMetadata[]>('/backups');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createBackup = async () => {
  try {
    const response = await apiClient.post<BackupMetadata>('/backups');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const restoreBackup = async (backupId: string, confirmation: string) => {
  try {
    const response = await apiClient.post<RestoreBackupResult>(
      `/backups/${backupId}/restore`,
      { confirmation },
      { timeout: 120000 },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const restoreBackupFromFile = async (
  file: File,
  confirmation: string,
) => {
  try {
    const response = await apiClient.post<RestoreBackupFromFileResult>(
      '/backups/restore-file',
      file,
      {
        headers: {
          'Content-Type': 'application/gzip',
          'X-Backup-Filename': file.name,
          'X-Restore-Confirmation': confirmation,
        },
        timeout: 120000,
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const downloadBackup = async (backupId: string) => {
  try {
    const response = await apiClient.get<Blob>(
      `/backups/${backupId}/download`,
      { responseType: 'blob' },
    );
    const disposition = response.headers['content-disposition'];
    const filenameMatch =
      typeof disposition === 'string'
        ? disposition.match(/filename="?([^"]+)"?/)
        : null;

    return {
      blob: response.data,
      filename: filenameMatch?.[1] ?? `${backupId}.archive.gz`,
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteBackup = async (backupId: string) => {
  try {
    const response = await apiClient.delete<DeleteBackupResult>(`/backups/${backupId}`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
