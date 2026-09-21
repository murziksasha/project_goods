import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createBackup,
  deleteBackup,
  downloadBackup,
  listBackups,
  restoreBackup,
  restoreBackupFromFile,
} from '../../../../entities/backup';
import type { BackupMetadata } from '../../../../entities/backup';
import { Button } from '../../../../shared/ui/Button';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { InlineError } from '../../../../shared/ui/InlineError';
import { LoadingState } from '../../../../shared/ui/LoadingState';
import { Modal } from '../../../../shared/ui/Modal';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { StatusBadge } from '../../../../shared/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../../shared/ui/StatusBadge';
import { PaginationPanel } from '../../../../shared/ui/PaginationPanel';

const formatBackupSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kilobytes = sizeBytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
};

const formatBackupDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('uk-UA');
};

const backupStatusTone: Record<BackupMetadata['status'], StatusBadgeTone> = {
  completed: 'success',
  failed: 'danger',
  running: 'info',
};

const backupTypeTone: Record<BackupMetadata['type'], StatusBadgeTone> = {
  manual: 'gray',
  safety: 'warning',
  scheduled: 'success',
};

export interface BackupsSectionProps {
  canManageBackups: boolean;
};

export const BackupsSection: React.FC<BackupsSectionProps> = ({ canManageBackups }) => {
  const { t } = useTranslation();
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [downloadingBackupId, setDownloadingBackupId] = useState('');
  const [deletingBackupId, setDeletingBackupId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BackupMetadata | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupMetadata | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreFileConfirmation, setRestoreFileConfirmation] = useState('');
  const [restoreFileError, setRestoreFileError] = useState('');
  const [isRestoreFileModalOpen, setIsRestoreFileModalOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showCreateTooltip, setShowCreateTooltip] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [error, setError] = useState('');
  const [backupsPage, setBackupsPage] = useState(1);
  const [backupsPageSize, setBackupsPageSize] = useState(30);
  const createTooltipTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = useCallback((text: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(text);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage('');
      toastTimeoutRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (createTooltipTimeoutRef.current) {
        window.clearTimeout(createTooltipTimeoutRef.current);
      }
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const refreshBackups = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true);
      setError('');
      try {
        setBackups(await listBackups());
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : t('settings.backups.messages.failedLoad'),
        );
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!canManageBackups) return;
    void refreshBackups();
  }, [canManageBackups, refreshBackups]);

  const paginatedBackups = useMemo(() => {
    const start = (backupsPage - 1) * backupsPageSize;
    return backups.slice(start, start + backupsPageSize);
  }, [backups, backupsPage, backupsPageSize]);

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(backups.length / backupsPageSize));
    if (backupsPage > pageCount) {
      setBackupsPage(pageCount);
    }
  }, [backups.length, backupsPage, backupsPageSize]);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setShowCreateTooltip(false);
    setError('');
    try {
      const backup = await createBackup();
      await refreshBackups({ silent: true });
      if (backup.status === 'completed') {
        setShowCreateTooltip(true);
        if (createTooltipTimeoutRef.current) {
          window.clearTimeout(createTooltipTimeoutRef.current);
        }
        createTooltipTimeoutRef.current = window.setTimeout(() => {
          setShowCreateTooltip(false);
          createTooltipTimeoutRef.current = null;
        }, 3000);
      } else {
        setError(backup.error || t('settings.backups.messages.finishedWithError'));
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('settings.backups.messages.failedCreate'),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownloadBackup = async (backup: BackupMetadata) => {
    setDownloadingBackupId(backup.id);
    setError('');
    try {
      const { blob, filename } = await downloadBackup(backup.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('settings.backups.messages.failedDownload'),
      );
    } finally {
      setDownloadingBackupId('');
    }
  };

  const handleDeleteBackup = async () => {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    setDeletingBackupId(deletedId);
    setError('');
    try {
      await deleteBackup(deletedId);
      setBackups((prev) => prev.filter((backup) => backup.id !== deletedId));
      setDeleteTarget(null);
      showToast(t('settings.backups.messages.deleted'));
      void refreshBackups({ silent: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('settings.backups.messages.failedDelete'),
      );
    } finally {
      setDeletingBackupId('');
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreTarget) return;
    setIsRestoring(true);
    setError('');
    try {
      const result = await restoreBackup(restoreTarget.id, restoreConfirmation);
      setRestoreTarget(null);
      setRestoreConfirmation('');
      await refreshBackups({ silent: true });
      showToast(
        t('settings.backups.messages.restored', {
          safetyBackupId: result.safetyBackupId,
        }),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('settings.backups.messages.failedRestore'),
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const closeRestoreFileModal = () => {
    setIsRestoreFileModalOpen(false);
    setRestoreFile(null);
    setRestoreFileConfirmation('');
    setRestoreFileError('');
  };

  const openRestoreFileModal = () => {
    setRestoreFileError('');
    setError('');
    setIsRestoreFileModalOpen(true);
  };

  const handleRestoreBackupFromFile = async () => {
    if (!restoreFile) return;
    setIsRestoring(true);
    setError('');
    setRestoreFileError('');
    try {
      const result = await restoreBackupFromFile(restoreFile, restoreFileConfirmation);
      closeRestoreFileModal();
      await refreshBackups({ silent: true });
      showToast(
        t('settings.backups.messages.restoredFromFile', {
          safetyBackupId: result.safetyBackupId,
        }),
      );
    } catch (requestError) {
      const messageText =
        requestError instanceof Error
          ? requestError.message
          : t('settings.backups.messages.failedRestoreFromFile');
      setRestoreFileError(messageText);
      setError(messageText);
    } finally {
      setIsRestoring(false);
    }
  };

  if (!canManageBackups) {
    return (
      <section className="settings-section">
        <EmptyState>{t('settings.backups.noPermission')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <PageHeader
        title={t('settings.backups.title')}
        subtitle={
          <>
            {t('settings.backups.subtitleCreate')}{' '}
            {t('settings.backups.subtitleSchedule')}
          </>
        }
        actions={
          <div className="settings-actions">
            <Button
              variant="success"
              onClick={openRestoreFileModal}
              disabled={isCreating || isRestoring}
            >
              {t('settings.backups.restoreFromFile')}
            </Button>
            <div className="backup-create-action-wrapper">
              <Button
                onClick={() => void handleCreateBackup()}
                disabled={isCreating || isRestoring}
              >
                {isCreating
                  ? t('settings.backups.creating')
                  : t('settings.backups.createBackup')}
              </Button>
              {showCreateTooltip ? (
                <div className="backup-create-tooltip" role="status">
                  <span className="backup-create-tooltip-icon" aria-hidden="true">✓</span>
                  <span>{t('settings.backups.messages.created')}</span>
                </div>
              ) : null}
            </div>
          </div>
        }
      />

      {toastMessage ? (
        <aside className="toast-stack" aria-live="polite" aria-atomic="true">
          <p className="toast toast-success" role="status">
            <span>{toastMessage}</span>
            <button
              type="button"
              className="toast-close"
              aria-label={t('common.close') || 'Close'}
              onClick={() => setToastMessage('')}
            >
              ×
            </button>
          </p>
        </aside>
      ) : null}
      {error && !isRestoreFileModalOpen ? <InlineError>{error}</InlineError> : null}

      {isLoading ? (
        <LoadingState>{t('settings.backups.loading')}</LoadingState>
      ) : backups.length === 0 ? (
        <EmptyState>{t('settings.backups.empty')}</EmptyState>
      ) : (
        <div className="backup-list" aria-label={t('settings.backups.archivesAriaLabel')}>
          {paginatedBackups.map((backup) => (
            <article
              key={backup.id}
              className={`backup-card backup-card-${backup.status}`}
            >
              <div className="backup-card-main">
                <div className="backup-created-cell">
                  <div className="backup-card-title-row">
                    <strong>{formatBackupDate(backup.createdAt)}</strong>
                  </div>
                  <span>{backup.id}</span>
                </div>
                <div className="backup-card-badges">
                  <StatusBadge
                    tone={backupStatusTone[backup.status]}
                    label={t(`settings.backups.status.${backup.status}`)}
                  />
                  <StatusBadge
                    tone={backupTypeTone[backup.type]}
                    label={t(`settings.backups.type.${backup.type}`)}
                  />
                </div>
                <dl className="backup-card-meta">
                  <div>
                    <dt>{t('settings.backups.size')}</dt>
                    <dd>{formatBackupSize(backup.sizeBytes)}</dd>
                  </div>
                  <div>
                    <dt>{t('settings.backups.author')}</dt>
                    <dd>{backup.author || '-'}</dd>
                  </div>
                </dl>
                <div className="card-actions backup-actions">
                  <Button
                    variant="ghost"
                    onClick={() => void handleDownloadBackup(backup)}
                    disabled={
                      backup.status !== 'completed' ||
                      downloadingBackupId === backup.id ||
                      isRestoring
                    }
                  >
                    {downloadingBackupId === backup.id
                      ? t('settings.backups.downloading')
                      : t('settings.backups.download')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setDeleteTarget(backup)}
                    disabled={backup.status === 'running' || isCreating || isRestoring}
                  >
                    {t('settings.backups.delete')}
                  </Button>
                  <Button
                    variant="warning"
                    onClick={() => {
                      setRestoreTarget(backup);
                      setRestoreConfirmation('');
                    }}
                    disabled={backup.status !== 'completed' || isCreating || isRestoring}
                  >
                    {t('settings.backups.restore')}
                  </Button>
                </div>
              </div>
              {backup.error ? (
                <div className="backup-error-panel">
                  <strong>{t('settings.backups.error')}</strong>
                  <p>{backup.error}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {backups.length > 0 ? (
        <PaginationPanel
          totalItems={backups.length}
          page={backupsPage}
          pageSize={backupsPageSize}
          onPageChange={setBackupsPage}
          onPageSizeChange={(nextPageSize) => {
            setBackupsPageSize(nextPageSize);
            setBackupsPage(1);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <Modal
          isOpen
          title={t('settings.backups.deleteTitle')}
          onClose={() => setDeleteTarget(null)}
          closeLabel={t('common.close')}
          shellClassName="payment-modal payment-modal-message modal-dialog"
          closeOnBackdrop={deletingBackupId !== deleteTarget.id}
          closeOnEscape={deletingBackupId !== deleteTarget.id}
          footer={
            <footer className="payment-modal-footer">
              <div className="payment-modal-actions">
                <Button
                  variant="secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deletingBackupId === deleteTarget.id}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void handleDeleteBackup()}
                  disabled={deletingBackupId === deleteTarget.id}
                >
                  {deletingBackupId === deleteTarget.id
                    ? t('settings.backups.deleting')
                    : t('settings.backups.delete')}
                </Button>
              </div>
            </footer>
          }
        >
          <p>{t('settings.backups.deleteMessage', { id: deleteTarget.id })}</p>
        </Modal>
      ) : null}

      {restoreTarget ? (
        <Modal
          isOpen
          title={t('settings.backups.restoreTitle')}
          onClose={() => {
            setRestoreTarget(null);
            setRestoreConfirmation('');
          }}
          closeLabel={t('common.close')}
          shellClassName="payment-modal payment-modal-message modal-dialog"
          closeOnBackdrop={!isRestoring}
          closeOnEscape={!isRestoring}
          footer={
            <footer className="payment-modal-footer">
              <div className="payment-modal-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRestoreTarget(null);
                    setRestoreConfirmation('');
                  }}
                  disabled={isRestoring}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="warning"
                  onClick={() => void handleRestoreBackup()}
                  disabled={isRestoring || restoreConfirmation !== 'RESTORE'}
                >
                  {isRestoring
                    ? t('settings.backups.restoring')
                    : t('settings.backups.restore')}
                </Button>
              </div>
            </footer>
          }
        >
          <p>{t('settings.backups.restoreMessage', { id: restoreTarget.id })}</p>
          <label className="field field-wide">
            <span>{t('settings.backups.typeRestoreToConfirm')}</span>
            <input
              value={restoreConfirmation}
              onChange={(event) => setRestoreConfirmation(event.target.value)}
              placeholder={t('settings.backups.restorePlaceholder')}
            />
          </label>
        </Modal>
      ) : null}

      {isRestoreFileModalOpen ? (
        <Modal
          isOpen
          title={t('settings.backups.restoreFromFileTitle')}
          onClose={closeRestoreFileModal}
          closeLabel={t('common.close')}
          shellClassName="payment-modal payment-modal-message modal-dialog"
          closeOnBackdrop={!isRestoring}
          closeOnEscape={!isRestoring}
          footer={
            <footer className="payment-modal-footer">
              <div className="payment-modal-actions">
                <Button
                  variant="secondary"
                  onClick={closeRestoreFileModal}
                  disabled={isRestoring}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="success"
                  onClick={() => void handleRestoreBackupFromFile()}
                  disabled={
                    isRestoring || !restoreFile || restoreFileConfirmation !== 'RESTORE'
                  }
                >
                  {isRestoring
                    ? t('settings.backups.restoring')
                    : t('settings.backups.restoreFromFileButton')}
                </Button>
              </div>
            </footer>
          }
        >
          <p>{t('settings.backups.restoreFromFileMessage')}</p>
          {restoreFileError ? (
            <p className="empty-state" role="alert">
              {restoreFileError}
            </p>
          ) : null}
          <label className="field field-wide">
            <span>{t('settings.backups.backupArchiveFile')}</span>
            <input
              type="file"
              accept=".gz,.archive.gz,application/gzip,application/octet-stream"
              onChange={(event) => {
                setRestoreFile(event.target.files?.[0] ?? null);
                setRestoreFileError('');
              }}
            />
          </label>
          {restoreFile ? (
            <p className="backup-file-selection">{restoreFile.name}</p>
          ) : null}
          <label className="field field-wide">
            <span>{t('settings.backups.typeRestoreToConfirm')}</span>
            <input
              value={restoreFileConfirmation}
              onChange={(event) => setRestoreFileConfirmation(event.target.value)}
              placeholder={t('settings.backups.restorePlaceholder')}
            />
          </label>
        </Modal>
      ) : null}
    </section>
  );
};
