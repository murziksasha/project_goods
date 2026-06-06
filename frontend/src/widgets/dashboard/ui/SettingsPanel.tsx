import { useEffect, useMemo, useState } from 'react';
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

export const SettingsPanel = ({
  form,
  isSaving,
  onChange,
  onSubmit,
}: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(getStoredSettingsTab);
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
        <button
          className="primary-button"
          type="button"
          onClick={onSubmit}
          disabled={isSaveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save settings'}
        </button>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {settingsTabs.map((tab) => (
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

      {activeTab === 'company' ? (
        <CompanySettingsSection
          form={form}
          validation={companyValidation}
          onChange={onChange}
        />
      ) : null}

      {activeTab === 'print' ? (
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

    </section>
  );
};
