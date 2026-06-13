import { useEffect, useMemo, useState } from 'react';
import {
  createBackup,
  deleteBackup,
  downloadBackup,
  listBackups,
  restoreBackup,
  restoreBackupFromFile,
} from '../../../entities/backup/api/backupApi';
import type { BackupMetadata } from '../../../entities/backup/model/types';
import type {
  AppSettingsFormValues,
  PrintForm,
} from '../../../entities/settings/model/types';
import { normalizePrintFormsForView } from '../../../entities/settings/model/printForms';
import { createNewPrintForm } from '../model/print-form-builder';
import {
  getCompanyValidation,
  getSettingsPreviewValues,
  getStoredSettingsTab,
  settingsTabs,
  settingsTabStorageKey,
  type SettingsTab,
} from '../model/settings-panel';
import { PrintFormBuilder } from './PrintFormBuilder';

type SettingsPanelProps = {
  form: AppSettingsFormValues;
  isSaving: boolean;
  canEditSettings: boolean;
  canManageBackups: boolean;
  onChange: <K extends keyof AppSettingsFormValues>(
    field: K,
    value: AppSettingsFormValues[K],
  ) => void;
  onSubmit: () => void;
};

type SettingsChangeHandler = SettingsPanelProps['onChange'];

type CompanyValidation = ReturnType<typeof getCompanyValidation>;

type CompanySettingsSectionProps = {
  form: AppSettingsFormValues;
  validation: CompanyValidation;
  onChange: SettingsChangeHandler;
};

const CompanySettingsSection = ({
  form,
  validation,
  onChange,
}: CompanySettingsSectionProps) => (
  <section className="settings-section">
    <div className="form-grid">
      <label className="field field-wide">
        <span>Service name in header</span>
        <input
          value={form.serviceName}
          onChange={(event) => onChange('serviceName', event.target.value)}
          placeholder="Service CRM"
        />
      </label>
      <label className="field">
        <span>Company name ({'{{company}}'})</span>
        <input
          value={form.company}
          onChange={(event) => onChange('company', event.target.value)}
          placeholder="Company name"
          aria-invalid={!validation.isCompanyNameValid}
        />
        {!validation.isCompanyNameValid ? (
          <small>Company name must be at least 2 characters.</small>
        ) : null}
      </label>
      <label className="field">
        <span>Company ID ({'{{company_id}}'})</span>
        <input
          value={form.companyId}
          onChange={(event) => onChange('companyId', event.target.value)}
          placeholder="Company registration ID"
          aria-invalid={!validation.isCompanyIdValid}
        />
        {!validation.isCompanyIdValid ? (
          <small>Company ID must be 8-12 characters (letters, digits, dash).</small>
        ) : null}
      </label>
      <label className="field field-wide">
        <span>Company address ({'{{company_address}}'})</span>
        <input
          value={form.companyAddress}
          onChange={(event) => onChange('companyAddress', event.target.value)}
          placeholder="Company address"
          aria-invalid={!validation.isCompanyAddressValid}
        />
        {!validation.isCompanyAddressValid ? (
          <small>Company address must be at least 5 characters.</small>
        ) : null}
      </label>
      <label className="field field-wide">
        <span>Company IBAN ({'{{company_iban}}'})</span>
        <input
          value={form.companyIban}
          onChange={(event) => onChange('companyIban', event.target.value)}
          placeholder="UA00 0000 0000 0000 0000 0000 0000 000"
          aria-invalid={!validation.isCompanyIbanValid}
        />
        {!validation.isCompanyIbanValid ? (
          <small>IBAN must match UA + 27 digits (spaces are allowed).</small>
        ) : null}
      </label>
      <label className="field">
        <span>Company e-mail ({'{{company_email}}'})</span>
        <input
          value={form.companyEmail}
          onChange={(event) => onChange('companyEmail', event.target.value)}
          placeholder="service@example.com"
        />
      </label>
      <label className="field">
        <span>Company site ({'{{company_site}}'})</span>
        <input
          value={form.companySite}
          onChange={(event) => onChange('companySite', event.target.value)}
          placeholder="https://example.com"
        />
      </label>
    </div>
  </section>
);

type PrintFormsSectionProps = {
  printForms: PrintForm[];
  selectedForm?: PrintForm;
  previewValues: Record<string, string>;
  onAddPrintForm: () => void;
  onDuplicateSelectedForm: () => void;
  onDeleteSelectedForm: () => void;
  onSelectForm: (formId: string) => void;
  onUpdateForm: (formId: string, patch: Partial<PrintForm>) => void;
  onUpdateForms: (forms: PrintForm[]) => void;
};

const PrintFormsSection = ({
  printForms,
  selectedForm,
  previewValues,
  onAddPrintForm,
  onDuplicateSelectedForm,
  onDeleteSelectedForm,
  onSelectForm,
  onUpdateForm,
  onUpdateForms,
}: PrintFormsSectionProps) => (
  <section className="settings-section settings-print-section">
    <div className="panel-header panel-header-row">
      <div>
        <p className="section-label">Print forms</p>
        <div className="settings-print-title-row">
          <h2>Order documents</h2>
          <label className="settings-print-document-select">
            <span className="visually-hidden">Document template</span>
            <select
              value={selectedForm?.id ?? ''}
              onChange={(event) => onSelectForm(event.target.value)}
            >
              {printForms.map((printForm) => (
                <option key={printForm.id} value={printForm.id}>
                  {printForm.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="settings-actions">
        <button type="button" className="secondary-button" onClick={onAddPrintForm}>
          Add
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onDuplicateSelectedForm}
          disabled={!selectedForm}
        >
          Duplicate
        </button>
      </div>
    </div>

    <div className="settings-print-grid">
      {selectedForm ? (
        <PrintFormBuilder
          key={selectedForm.id}
          forms={printForms}
          selectedForm={selectedForm}
          previewValues={previewValues}
          onSelectForm={onSelectForm}
          onUpdateForms={onUpdateForms}
          onUpdateForm={onUpdateForm}
          onDeleteForm={onDeleteSelectedForm}
        />
      ) : null}
    </div>
  </section>
);

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

const getBackupStatusLabel = (status: BackupMetadata['status']) =>
  status.charAt(0).toUpperCase() + status.slice(1);

const getBackupTypeLabel = (type: BackupMetadata['type']) =>
  type.charAt(0).toUpperCase() + type.slice(1);

type BackupsSectionProps = {
  canManageBackups: boolean;
};

const BackupsSection = ({ canManageBackups }: BackupsSectionProps) => {
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
  const [isRestoreFileModalOpen, setIsRestoreFileModalOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refreshBackups = async () => {
    setIsLoading(true);
    setError('');
    try {
      setBackups(await listBackups());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load backups.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageBackups) return;
    void refreshBackups();
  }, [canManageBackups]);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setMessage('');
    setError('');
    try {
      const backup = await createBackup();
      await refreshBackups();
      setMessage(
        backup.status === 'completed'
          ? 'Backup created.'
          : backup.error || 'Backup finished with an error.',
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create backup.');
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
      setError(requestError instanceof Error ? requestError.message : 'Failed to download backup.');
    } finally {
      setDownloadingBackupId('');
    }
  };

  const handleDeleteBackup = async () => {
    if (!deleteTarget) return;
    setDeletingBackupId(deleteTarget.id);
    setMessage('');
    setError('');
    try {
      await deleteBackup(deleteTarget.id);
      setDeleteTarget(null);
      await refreshBackups();
      setMessage('Backup deleted.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to delete backup.');
    } finally {
      setDeletingBackupId('');
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreTarget) return;
    setIsRestoring(true);
    setMessage('');
    setError('');
    try {
      const result = await restoreBackup(restoreTarget.id, restoreConfirmation);
      setRestoreTarget(null);
      setRestoreConfirmation('');
      await refreshBackups();
      setMessage(`Backup restored. Safety backup: ${result.safetyBackupId}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to restore backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  const closeRestoreFileModal = () => {
    setIsRestoreFileModalOpen(false);
    setRestoreFile(null);
    setRestoreFileConfirmation('');
  };

  const handleRestoreBackupFromFile = async () => {
    if (!restoreFile) return;
    setIsRestoring(true);
    setMessage('');
    setError('');
    try {
      const result = await restoreBackupFromFile(
        restoreFile,
        restoreFileConfirmation,
      );
      closeRestoreFileModal();
      await refreshBackups();
      setMessage(`Backup file restored. Safety backup: ${result.safetyBackupId}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to restore backup from file.',
      );
    } finally {
      setIsRestoring(false);
    }
  };

  if (!canManageBackups) {
    return (
      <section className="settings-section">
        <p className="empty-state">Current employee cannot manage backups.</p>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <div className="panel-header panel-header-row">
        <div>
          <p className="section-label">Database backups</p>
          <h2>Manual restore points</h2>
          <p className="panel-subtitle">
            Create MongoDB archives, download them, or restore a completed backup.
          </p>
          <p className="panel-subtitle">
            Automatic backup: daily at 15:00 server time, scheduled copies kept for
            14 days.
          </p>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="success-button"
            onClick={() => setIsRestoreFileModalOpen(true)}
            disabled={isCreating || isRestoring}
          >
            Restore from file
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleCreateBackup()}
            disabled={isCreating || isRestoring}
          >
            {isCreating ? 'Creating...' : 'Create backup'}
          </button>
        </div>
      </div>

      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="empty-state">{error}</p> : null}

      {isLoading ? (
        <p className="empty-state">Loading backups...</p>
      ) : backups.length === 0 ? (
        <p className="empty-state">No backups yet.</p>
      ) : (
        <div className="backup-list" aria-label="Backup archives">
          {backups.map((backup) => (
            <article
              key={backup.id}
              className={`backup-card backup-card-${backup.status}`}
            >
              <div className="backup-card-main">
                <div className="backup-created-cell">
                  <strong>{formatBackupDate(backup.createdAt)}</strong>
                  <span>{backup.id}</span>
                </div>
                <div className="backup-card-badges">
                  <span className={`backup-badge backup-badge-${backup.status}`}>
                    {getBackupStatusLabel(backup.status)}
                  </span>
                  <span className={`backup-badge backup-badge-${backup.type}`}>
                    {getBackupTypeLabel(backup.type)}
                  </span>
                </div>
                <dl className="backup-card-meta">
                  <div>
                    <dt>Size</dt>
                    <dd>{formatBackupSize(backup.sizeBytes)}</dd>
                  </div>
                  <div>
                    <dt>Author</dt>
                    <dd>{backup.author || '-'}</dd>
                  </div>
                </dl>
                <div className="card-actions backup-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleDownloadBackup(backup)}
                    disabled={
                      backup.status !== 'completed' ||
                      downloadingBackupId === backup.id ||
                      isRestoring
                    }
                  >
                    {downloadingBackupId === backup.id ? 'Downloading...' : 'Download'}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => setDeleteTarget(backup)}
                    disabled={backup.status === 'running' || isCreating || isRestoring}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="warning-button"
                    onClick={() => {
                      setRestoreTarget(backup);
                      setRestoreConfirmation('');
                    }}
                    disabled={backup.status !== 'completed' || isCreating || isRestoring}
                  >
                    Restore
                  </button>
                </div>
              </div>
              {backup.error ? (
                <div className="backup-error-panel">
                  <strong>Error</strong>
                  <p>{backup.error}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {deleteTarget ? (
        <div className="modal-backdrop" role="presentation">
          <section className="payment-modal payment-modal-message" role="dialog" aria-modal="true">
            <div className="payment-modal-summary">
              <h3>Delete backup</h3>
              <p>
                Delete "{deleteTarget.id}"? The archive and metadata file will be
                removed from the backup folder.
              </p>
            </div>
            <footer className="payment-modal-footer">
              <div className="payment-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deletingBackupId === deleteTarget.id}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void handleDeleteBackup()}
                  disabled={deletingBackupId === deleteTarget.id}
                >
                  {deletingBackupId === deleteTarget.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      {restoreTarget ? (
        <div className="modal-backdrop" role="presentation">
          <section className="payment-modal payment-modal-message" role="dialog" aria-modal="true">
            <div className="payment-modal-summary">
              <h3>Restore backup</h3>
              <p>
                Restoring "{restoreTarget.id}" will replace current MongoDB data.
                A safety backup will be created first.
              </p>
            </div>
            <label className="field field-wide">
              <span>Type RESTORE to confirm</span>
              <input
                value={restoreConfirmation}
                onChange={(event) => setRestoreConfirmation(event.target.value)}
                placeholder="RESTORE"
              />
            </label>
            <footer className="payment-modal-footer">
              <div className="payment-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setRestoreTarget(null);
                    setRestoreConfirmation('');
                  }}
                  disabled={isRestoring}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="warning-button"
                  onClick={() => void handleRestoreBackup()}
                  disabled={isRestoring || restoreConfirmation !== 'RESTORE'}
                >
                  {isRestoring ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      {isRestoreFileModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="payment-modal payment-modal-message" role="dialog" aria-modal="true">
            <div className="payment-modal-summary">
              <h3>Restore from file</h3>
              <p>
                Select a downloaded .archive.gz backup. Current MongoDB data will
                be replaced after a safety backup is created.
              </p>
            </div>
            <label className="field field-wide">
              <span>Backup archive file</span>
              <input
                type="file"
                accept=".gz,.archive.gz,application/gzip,application/octet-stream"
                onChange={(event) =>
                  setRestoreFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            {restoreFile ? (
              <p className="backup-file-selection">{restoreFile.name}</p>
            ) : null}
            <label className="field field-wide">
              <span>Type RESTORE to confirm</span>
              <input
                value={restoreFileConfirmation}
                onChange={(event) =>
                  setRestoreFileConfirmation(event.target.value)
                }
                placeholder="RESTORE"
              />
            </label>
            <footer className="payment-modal-footer">
              <div className="payment-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeRestoreFileModal}
                  disabled={isRestoring}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="success-button"
                  onClick={() => void handleRestoreBackupFromFile()}
                  disabled={
                    isRestoring ||
                    !restoreFile ||
                    restoreFileConfirmation !== 'RESTORE'
                  }
                >
                  {isRestoring ? 'Restoring...' : 'Restore from file'}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
};

export const SettingsPanel = ({
  form,
  isSaving,
  canEditSettings,
  canManageBackups,
  onChange,
  onSubmit,
}: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(getStoredSettingsTab);
  const visibleSettingsTabs = useMemo(
    () =>
      settingsTabs.filter((tab) =>
        tab.key === 'backups' ? canManageBackups : canEditSettings,
      ),
    [canEditSettings, canManageBackups],
  );
  const printForms = useMemo(
    () => normalizePrintFormsForView(form.printForms),
    [form.printForms],
  );
  const [selectedFormId, setSelectedFormId] = useState(
    () => printForms[0]?.id ?? '',
  );
  const selectedForm =
    printForms.find((printForm) => printForm.id === selectedFormId) ??
    printForms[0];
  const previewValues = useMemo(
    () => getSettingsPreviewValues(form),
    [
      form.company,
      form.companyAddress,
      form.companyEmail,
      form.companyIban,
      form.companyId,
      form.companySite,
      form.serviceName,
    ],
  );
  const companyValidation = useMemo(
    () => getCompanyValidation(form),
    [form.company, form.companyAddress, form.companyIban, form.companyId],
  );
  const hasInvalidPrintForms = printForms.some(
    (printForm) => !printForm.title.trim() || !printForm.content.trim(),
  );
  const isSaveDisabled =
    !canEditSettings ||
    isSaving ||
    form.serviceName.trim().length < 2 ||
    hasInvalidPrintForms ||
    companyValidation.hasInvalidCompanyFields;

  const updatePrintForms = (nextForms: PrintForm[]) => {
    onChange('printForms', normalizePrintFormsForView(nextForms));
  };

  const updateFormById = (formId: string, patch: Partial<PrintForm>) => {
    updatePrintForms(
      printForms.map((printForm) =>
        printForm.id === formId ? { ...printForm, ...patch } : printForm,
      ),
    );
  };

  const addPrintForm = () => {
    const nextForm = createNewPrintForm((printForms.length + 1) * 10);
    updatePrintForms([...printForms, nextForm]);
    setSelectedFormId(nextForm.id);
  };

  const duplicateSelectedForm = () => {
    if (!selectedForm) return;
    const nextForm = {
      ...selectedForm,
      id: `form-${Date.now()}`,
      title: `${selectedForm.title} copy`,
      sortOrder: (printForms.length + 1) * 10,
    };
    updatePrintForms([...printForms, nextForm]);
    setSelectedFormId(nextForm.id);
  };

  const deleteSelectedForm = () => {
    if (!selectedForm || printForms.length <= 1) return;
    const nextForms = printForms.filter(
      (printForm) => printForm.id !== selectedForm.id,
    );
    updatePrintForms(nextForms);
    setSelectedFormId(nextForms[0]?.id ?? '');
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(settingsTabStorageKey, activeTab);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeTab]);

  useEffect(() => {
    if (visibleSettingsTabs.some((tab) => tab.key === activeTab)) return;
    setActiveTab(visibleSettingsTabs[0]?.key ?? 'company');
  }, [activeTab, visibleSettingsTabs]);

  useEffect(() => {
    if (printForms.length === 0) return;
    if (printForms.some((printForm) => printForm.id === selectedFormId)) return;
    setSelectedFormId(printForms[0].id);
  }, [printForms, selectedFormId]);

  return (
    <section className="panel settings-page">
      <div className="panel-header panel-header-row">
        <div>
          <p className="section-label">Settings</p>
          <h2>Service configuration</h2>
          <p className="panel-subtitle">
            Global CRM settings for orders, print forms, finance and future
            client notifications.
          </p>
        </div>
        {canEditSettings && activeTab !== 'backups' ? (
          <button
            className="primary-button"
            type="button"
            onClick={onSubmit}
            disabled={isSaveDisabled}
          >
            {isSaving ? 'Saving...' : 'Save settings'}
          </button>
        ) : null}
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {visibleSettingsTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              tab.key === activeTab
                ? 'settings-tab settings-tab-active'
                : 'settings-tab'
            }
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'company' && canEditSettings ? (
        <CompanySettingsSection
          form={form}
          validation={companyValidation}
          onChange={onChange}
        />
      ) : null}

      {activeTab === 'print' && canEditSettings ? (
        <PrintFormsSection
          printForms={printForms}
          selectedForm={selectedForm}
          previewValues={previewValues}
          onAddPrintForm={addPrintForm}
          onDuplicateSelectedForm={duplicateSelectedForm}
          onDeleteSelectedForm={deleteSelectedForm}
          onSelectForm={setSelectedFormId}
          onUpdateForm={updateFormById}
          onUpdateForms={updatePrintForms}
        />
      ) : null}

      {activeTab === 'backups' ? (
        <BackupsSection canManageBackups={canManageBackups} />
      ) : null}

    </section>
  );
};
