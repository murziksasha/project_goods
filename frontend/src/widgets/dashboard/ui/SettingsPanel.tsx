import { useEffect, useState } from 'react';
import type { AppSettingsFormValues } from '../../../entities/settings/model/types';

type SettingsPanelProps = {
  form: AppSettingsFormValues;
  isSaving: boolean;
  onChange: <K extends keyof AppSettingsFormValues>(
    field: K,
    value: AppSettingsFormValues[K],
  ) => void;
  onSubmit: () => void;
};

type PrintForm = {
  id: string;
  title: string;
  content: string;
};

const printFormsStorageKey = 'project-goods.print-forms';

const defaultPrintForms: PrintForm[] = [
  {
    id: 'receipt',
    title: 'Receipt',
    content: 'Receipt for order {{orderNumber}}\nClient: {{clientName}}\nDevice: {{deviceName}}\nAmount: {{total}}',
  },
  {
    id: 'check',
    title: 'Check',
    content: 'Check\nOrder: {{orderNumber}}\nPaid: {{paid}}\nTo pay: {{toPay}}',
  },
  {
    id: 'warranty',
    title: 'Warranty',
    content: 'Warranty document\nDevice: {{deviceName}}\nS/N: {{serialNumber}}\nClient: {{clientName}}',
  },
  {
    id: 'completion-act',
    title: 'Completion act',
    content: 'Completion act\nOrder: {{orderNumber}}\nWork: {{note}}\nTotal: {{total}}',
  },
  {
    id: 'invoice',
    title: 'Invoice',
    content: 'Invoice for payment\nOrder: {{orderNumber}}\nClient: {{clientName}}\nTotal: {{total}}',
  },
  {
    id: 'barcode',
    title: 'Barcode',
    content: 'Barcode form\nOrder: {{orderNumber}}\nS/N: {{serialNumber}}',
  },
];

const readPrintForms = () => {
  try {
    const forms = JSON.parse(window.localStorage.getItem(printFormsStorageKey) ?? '[]') as PrintForm[];
    return forms.length > 0 ? forms : defaultPrintForms;
  } catch {
    return defaultPrintForms;
  }
};

export const SettingsPanel = ({
  form,
  isSaving,
  onChange,
  onSubmit,
}: SettingsPanelProps) => {
  const [printForms, setPrintForms] = useState<PrintForm[]>(readPrintForms);
  const [selectedFormId, setSelectedFormId] = useState(printForms[0]?.id ?? '');
  const selectedForm = printForms.find((printForm) => printForm.id === selectedFormId) ?? printForms[0];

  useEffect(() => {
    window.localStorage.setItem(printFormsStorageKey, JSON.stringify(printForms));
  }, [printForms]);

  const updateSelectedForm = (patch: Partial<PrintForm>) => {
    if (!selectedForm) return;

    setPrintForms((current) =>
      current.map((printForm) =>
        printForm.id === selectedForm.id ? { ...printForm, ...patch } : printForm,
      ),
    );
  };

  const addPrintForm = () => {
    const newForm: PrintForm = {
      id: `form-${Date.now()}`,
      title: 'New form',
      content: 'Order: {{orderNumber}}\nClient: {{clientName}}\nDevice: {{deviceName}}',
    };

    setPrintForms((current) => [...current, newForm]);
    setSelectedFormId(newForm.id);
  };

  const deleteSelectedForm = () => {
    if (!selectedForm || printForms.length <= 1) return;

    const nextForms = printForms.filter((printForm) => printForm.id !== selectedForm.id);
    setPrintForms(nextForms);
    setSelectedFormId(nextForms[0]?.id ?? '');
  };

  return (
    <section className="panel settings-page">
      <div className="panel-header">
        <div>
          <p className="section-label">Settings</p>
          <h2>Service configuration</h2>
        </div>
      </div>

      <div className="form-grid">
        <label className="field field-wide">
          <span>Service name in header</span>
          <input
            value={form.serviceName}
            onChange={(event) => onChange('serviceName', event.target.value)}
            placeholder="Service CRM"
          />
        </label>
      </div>

      <button
        className="primary-button"
        type="button"
        onClick={onSubmit}
        disabled={isSaving || form.serviceName.trim().length < 2}
      >
        {isSaving ? 'Saving...' : 'Save settings'}
      </button>

      <section className="settings-print-section">
        <div className="panel-header panel-header-row">
          <div>
            <p className="section-label">Print forms</p>
            <h2>Order documents</h2>
            <p className="panel-subtitle">
              Use placeholders: {'{{orderNumber}}'}, {'{{clientName}}'}, {'{{clientPhone}}'}, {'{{deviceName}}'}, {'{{serialNumber}}'}, {'{{total}}'}, {'{{paid}}'}, {'{{toPay}}'}, {'{{note}}'}.
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={addPrintForm}>
            Add form
          </button>
        </div>

        <div className="settings-print-grid">
          <div className="settings-print-list">
            {printForms.map((printForm) => (
              <button
                key={printForm.id}
                type="button"
                className={
                  printForm.id === selectedForm?.id
                    ? 'settings-print-list-item settings-print-list-item-active'
                    : 'settings-print-list-item'
                }
                onClick={() => setSelectedFormId(printForm.id)}
              >
                {printForm.title}
              </button>
            ))}
          </div>

          {selectedForm ? (
            <div className="settings-print-editor">
              <label className="field">
                <span>Form title</span>
                <input
                  value={selectedForm.title}
                  onChange={(event) => updateSelectedForm({ title: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Template content</span>
                <textarea
                  rows={12}
                  value={selectedForm.content}
                  onChange={(event) => updateSelectedForm({ content: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="danger-button"
                onClick={deleteSelectedForm}
                disabled={printForms.length <= 1}
              >
                Delete form
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
};
