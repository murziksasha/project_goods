import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AppSettingsFormValues,
  PrintForm,
} from '../../../../entities/settings/model/types';
import { normalizePrintFormsForView } from '../../../../entities/settings/model/printForms';
import { createNewPrintForm } from '../../model/print-form-builder';
import {
  getCompanyValidation,
  getSettingsPreviewValues,
  getStoredSettingsTab,
  settingsTabs,
  settingsTabStorageKey,
  type SettingsTab,
} from '../../model/settings-panel';
import { Button } from '../../../../shared/ui/Button';
import { LoadingState } from '../../../../shared/ui/LoadingState';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { BackupsSection } from './BackupsSection';
import { CompanySettingsSection } from './CompanySettingsSection';
import { DashboardSettingsSection } from './DashboardSettingsSection';
import { DatabaseReportSection } from './DatabaseReportSection';
import { PrintFormsSection } from './PrintFormsSection';

type SettingsPanelProps = {
  form: AppSettingsFormValues;
  isSaving: boolean;
  /** False until /settings has loaded — avoids flashing default company fields. */
  isSettingsReady?: boolean;
  canEditSettings: boolean;
  canEditPrintForms: boolean;
  canManageBackups: boolean;
  onChange: <K extends keyof AppSettingsFormValues>(
    field: K,
    value: AppSettingsFormValues[K],
  ) => void;
  onSubmit: () => void;
};

export const SettingsPanel = ({
  form,
  isSaving,
  isSettingsReady = true,
  canEditSettings,
  canEditPrintForms,
  canManageBackups,
  onChange,
  onSubmit,
}: SettingsPanelProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(getStoredSettingsTab);
  const hasCachedCompanyFields =
    form.serviceName.trim().length > 0 || form.company.trim().length > 0;
  const showCompanyLoading = !isSettingsReady && !hasCachedCompanyFields;
  const visibleSettingsTabs = useMemo(
    () =>
      settingsTabs.filter((tab) => {
        if (tab.key === 'backups' || tab.key === 'database') return canManageBackups;
        if (tab.key === 'print') return canEditPrintForms;
        return canEditSettings;
      }),
    [canEditPrintForms, canEditSettings, canManageBackups],
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
  const previewValues = useMemo(() => getSettingsPreviewValues(form), [form]);
  const companyValidation = useMemo(() => getCompanyValidation(form), [form]);
  const hasInvalidPrintForms = printForms.some(
    (printForm) => !printForm.title.trim() || !printForm.content.trim(),
  );
  const canSaveActiveTab =
    activeTab === 'print'
      ? canEditPrintForms
      : activeTab === 'backups' || activeTab === 'database'
        ? false
        : canEditSettings;

  const isSaveDisabled =
    !canSaveActiveTab ||
    isSaving ||
    hasInvalidPrintForms ||
    (canEditSettings &&
      (form.serviceName.trim().length < 2 ||
        companyValidation.hasInvalidCompanyFields));

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

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const keys = visibleSettingsTabs.map((tab) => tab.key);
    const index = keys.indexOf(activeTab);
    if (index < 0) return;
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = keys[(index + delta + keys.length) % keys.length];
    event.preventDefault();
    setActiveTab(next);
  };

  return (
    <section className="panel settings-page">
      <PageHeader
        title={t('settings.panel.title')}
        subtitle={t('settings.panel.subtitle')}
        actions={
          canSaveActiveTab ? (
            <Button onClick={onSubmit} disabled={isSaveDisabled}>
              {isSaving ? t('settings.panel.saving') : t('settings.panel.saveSettings')}
            </Button>
          ) : null
        }
      />

      <div
        className="settings-tabs"
        role="tablist"
        aria-label={t('settings.tabsAriaLabel')}
        onKeyDown={handleTabKeyDown}
      >
        {visibleSettingsTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`settings-tab-${tab.key}`}
            aria-selected={tab.key === activeTab}
            aria-controls={`settings-panel-${tab.key}`}
            tabIndex={tab.key === activeTab ? 0 : -1}
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
        <div
          role="tabpanel"
          id="settings-panel-company"
          aria-labelledby="settings-tab-company"
        >
          {showCompanyLoading ? (
            <section className="settings-section">
              <LoadingState>{t('settings.panel.loading')}</LoadingState>
            </section>
          ) : (
            <CompanySettingsSection
              form={form}
              validation={companyValidation}
              onChange={onChange}
            />
          )}
        </div>
      ) : null}

      {activeTab === 'dashboard' && canEditSettings ? (
        <div
          role="tabpanel"
          id="settings-panel-dashboard"
          aria-labelledby="settings-tab-dashboard"
        >
          {isSettingsReady ? (
            <DashboardSettingsSection
              preferences={form.dashboardPreferences}
              onChange={(dashboardPreferences) =>
                onChange('dashboardPreferences', dashboardPreferences)
              }
            />
          ) : (
            <section className="settings-section">
              <LoadingState>{t('settings.panel.loading')}</LoadingState>
            </section>
          )}
        </div>
      ) : null}

      {activeTab === 'print' && canEditPrintForms ? (
        <div
          role="tabpanel"
          id="settings-panel-print"
          aria-labelledby="settings-tab-print"
        >
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
        </div>
      ) : null}

      {activeTab === 'backups' ? (
        <div
          role="tabpanel"
          id="settings-panel-backups"
          aria-labelledby="settings-tab-backups"
        >
          <BackupsSection canManageBackups={canManageBackups} />
        </div>
      ) : null}

      {activeTab === 'database' ? (
        <div
          role="tabpanel"
          id="settings-panel-database"
          aria-labelledby="settings-tab-database"
        >
          <DatabaseReportSection canManageBackups={canManageBackups} />
        </div>
      ) : null}
    </section>
  );
};
