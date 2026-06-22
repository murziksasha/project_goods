import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';
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
}: CompanySettingsSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="settings-section">
      <div className="form-grid">
        <label className="field field-wide">
          <span>{t('settings.company.serviceNameInHeader')}</span>
          <input
            value={form.serviceName}
            onChange={(event) => onChange('serviceName', event.target.value)}
            placeholder={t('settings.company.serviceNamePlaceholder')}
          />
        </label>
        <label className="field">
          <span>{t('settings.company.companyName', { company: '{{company}}' })}</span>
          <input
            value={form.company}
            onChange={(event) => onChange('company', event.target.value)}
            placeholder={t('settings.company.companyNamePlaceholder')}
            aria-invalid={!validation.isCompanyNameValid}
          />
          {!validation.isCompanyNameValid ? (
            <small>{t('settings.company.companyNameMinLength')}</small>
          ) : null}
        </label>
        <label className="field">
          <span>{t('settings.company.companyId', { company_id: '{{company_id}}' })}</span>
          <input
            value={form.companyId}
            onChange={(event) => onChange('companyId', event.target.value)}
            placeholder={t('settings.company.companyIdPlaceholder')}
            aria-invalid={!validation.isCompanyIdValid}
          />
          {!validation.isCompanyIdValid ? (
            <small>{t('settings.company.companyIdFormat')}</small>
          ) : null}
        </label>
        <label className="field field-wide">
          <span>
            {t('settings.company.companyAddress', { company_address: '{{company_address}}' })}
          </span>
          <input
            value={form.companyAddress}
            onChange={(event) => onChange('companyAddress', event.target.value)}
            placeholder={t('settings.company.companyAddressPlaceholder')}
            aria-invalid={!validation.isCompanyAddressValid}
          />
          {!validation.isCompanyAddressValid ? (
            <small>{t('settings.company.companyAddressMinLength')}</small>
          ) : null}
        </label>
        <label className="field field-wide">
          <span>{t('settings.company.companyIban', { company_iban: '{{company_iban}}' })}</span>
          <input
            value={form.companyIban}
            onChange={(event) => onChange('companyIban', event.target.value)}
            placeholder={t('settings.company.companyIbanPlaceholder')}
            aria-invalid={!validation.isCompanyIbanValid}
          />
          {!validation.isCompanyIbanValid ? (
            <small>{t('settings.company.companyIbanFormat')}</small>
          ) : null}
        </label>
        <label className="field">
          <span>{t('settings.company.companyEmail', { company_email: '{{company_email}}' })}</span>
          <input
            value={form.companyEmail}
            onChange={(event) => onChange('companyEmail', event.target.value)}
            placeholder={t('settings.company.companyEmailPlaceholder')}
          />
        </label>
        <label className="field">
          <span>{t('settings.company.companySite', { company_site: '{{company_site}}' })}</span>
          <input
            value={form.companySite}
            onChange={(event) => onChange('companySite', event.target.value)}
            placeholder={t('settings.company.companySitePlaceholder')}
          />
        </label>
      </div>
    </section>
  );
};

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
}: PrintFormsSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="settings-section settings-print-section">
      <div className="panel-header panel-header-row">
        <div>
          <p className="section-label">{t('settings.print.sectionLabel')}</p>
          <div className="settings-print-title-row">
            <h2>{t('settings.print.title')}</h2>
            <label className="settings-print-document-select">
              <span className="visually-hidden">{t('settings.print.documentTemplate')}</span>
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
            {t('settings.print.add')}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onDuplicateSelectedForm}
            disabled={!selectedForm}
          >
            {t('settings.print.duplicate')}
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
};

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

type BackupsSectionProps = {
  canManageBackups: boolean;
};

const BackupsSection = ({ canManageBackups }: BackupsSectionProps) => {
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
  const [isRestoreFileModalOpen, setIsRestoreFileModalOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [backupsPage, setBackupsPage] = useState(1);
  const [backupsPageSize, setBackupsPageSize] = useState(30);

  const refreshBackups = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageBackups) return;
    void refreshBackups();
  }, [canManageBackups]);

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
    setMessage('');
    setError('');
    try {
      const backup = await createBackup();
      await refreshBackups();
      setMessage(
        backup.status === 'completed'
          ? t('settings.backups.messages.created')
          : backup.error || t('settings.backups.messages.finishedWithError'),
      );
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
    setDeletingBackupId(deleteTarget.id);
    setMessage('');
    setError('');
    try {
      await deleteBackup(deleteTarget.id);
      setDeleteTarget(null);
      await refreshBackups();
      setMessage(t('settings.backups.messages.deleted'));
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
    setMessage('');
    setError('');
    try {
      const result = await restoreBackup(restoreTarget.id, restoreConfirmation);
      setRestoreTarget(null);
      setRestoreConfirmation('');
      await refreshBackups();
      setMessage(
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
      setMessage(
        t('settings.backups.messages.restoredFromFile', {
          safetyBackupId: result.safetyBackupId,
        }),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('settings.backups.messages.failedRestoreFromFile'),
      );
    } finally {
      setIsRestoring(false);
    }
  };

  if (!canManageBackups) {
    return (
      <section className="settings-section">
        <p className="empty-state">{t('settings.backups.noPermission')}</p>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <div className="panel-header panel-header-row">
        <div>
          <p className="section-label">{t('settings.backups.sectionLabel')}</p>
          <h2>{t('settings.backups.title')}</h2>
          <p className="panel-subtitle">{t('settings.backups.subtitleCreate')}</p>
          <p className="panel-subtitle">{t('settings.backups.subtitleSchedule')}</p>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="success-button"
            onClick={() => setIsRestoreFileModalOpen(true)}
            disabled={isCreating || isRestoring}
          >
            {t('settings.backups.restoreFromFile')}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleCreateBackup()}
            disabled={isCreating || isRestoring}
          >
            {isCreating ? t('settings.backups.creating') : t('settings.backups.createBackup')}
          </button>
        </div>
      </div>

      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="empty-state">{error}</p> : null}

      {isLoading ? (
        <p className="empty-state">{t('settings.backups.loading')}</p>
      ) : backups.length === 0 ? (
        <p className="empty-state">{t('settings.backups.empty')}</p>
      ) : (
        <div className="backup-list" aria-label={t('settings.backups.archivesAriaLabel')}>
          {paginatedBackups.map((backup) => (
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
                    {t(`settings.backups.status.${backup.status}`)}
                  </span>
                  <span className={`backup-badge backup-badge-${backup.type}`}>
                    {t(`settings.backups.type.${backup.type}`)}
                  </span>
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
                    {downloadingBackupId === backup.id
                      ? t('settings.backups.downloading')
                      : t('settings.backups.download')}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => setDeleteTarget(backup)}
                    disabled={backup.status === 'running' || isCreating || isRestoring}
                  >
                    {t('settings.backups.delete')}
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
                    {t('settings.backups.restore')}
                  </button>
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
        <div className="modal-backdrop" role="presentation">
          <section className="payment-modal payment-modal-message" role="dialog" aria-modal="true">
            <div className="payment-modal-summary">
              <h3>{t('settings.backups.deleteTitle')}</h3>
              <p>{t('settings.backups.deleteMessage', { id: deleteTarget.id })}</p>
            </div>
            <footer className="payment-modal-footer">
              <div className="payment-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deletingBackupId === deleteTarget.id}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void handleDeleteBackup()}
                  disabled={deletingBackupId === deleteTarget.id}
                >
                  {deletingBackupId === deleteTarget.id
                    ? t('settings.backups.deleting')
                    : t('settings.backups.delete')}
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
              <h3>{t('settings.backups.restoreTitle')}</h3>
              <p>{t('settings.backups.restoreMessage', { id: restoreTarget.id })}</p>
            </div>
            <label className="field field-wide">
              <span>{t('settings.backups.typeRestoreToConfirm')}</span>
              <input
                value={restoreConfirmation}
                onChange={(event) => setRestoreConfirmation(event.target.value)}
                placeholder={t('settings.backups.restorePlaceholder')}
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
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="warning-button"
                  onClick={() => void handleRestoreBackup()}
                  disabled={isRestoring || restoreConfirmation !== 'RESTORE'}
                >
                  {isRestoring ? t('settings.backups.restoring') : t('settings.backups.restore')}
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
              <h3>{t('settings.backups.restoreFromFileTitle')}</h3>
              <p>{t('settings.backups.restoreFromFileMessage')}</p>
            </div>
            <label className="field field-wide">
              <span>{t('settings.backups.backupArchiveFile')}</span>
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
              <span>{t('settings.backups.typeRestoreToConfirm')}</span>
              <input
                value={restoreFileConfirmation}
                onChange={(event) =>
                  setRestoreFileConfirmation(event.target.value)
                }
                placeholder={t('settings.backups.restorePlaceholder')}
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
                  {t('common.cancel')}
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
                  {isRestoring
                    ? t('settings.backups.restoring')
                    : t('settings.backups.restoreFromFileButton')}
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
  const { t } = useTranslation();
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
    [form],
  );
  const companyValidation = useMemo(
    () => getCompanyValidation(form),
    [form],
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
      title: t('settings.print.duplicateTitle', { title: selectedForm.title }),
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
          <p className="section-label">{t('settings.panel.sectionLabel')}</p>
          <h2>{t('settings.panel.title')}</h2>
          <p className="panel-subtitle">{t('settings.panel.subtitle')}</p>
        </div>
        {canEditSettings && activeTab !== 'backups' ? (
          <button
            className="primary-button"
            type="button"
            onClick={onSubmit}
            disabled={isSaveDisabled}
          >
            {isSaving ? t('settings.panel.saving') : t('settings.panel.saveSettings')}
          </button>
        ) : null}
      </div>

      <div
        className="settings-tabs"
        role="tablist"
        aria-label={t('settings.tabsAriaLabel')}
      >
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
            {t(tab.labelKey)}
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
