import { useTranslation } from 'react-i18next';
import type { PrintForm } from '../../../../entities/settings/model/types';
import { Button } from '../../../../shared/ui/Button';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { PrintFormBuilder } from './PrintFormBuilder';

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

export const PrintFormsSection = ({
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
      <PageHeader
        title={t('settings.print.title')}
        subtitle={t('settings.print.subtitle')}
        actions={
          <div className="settings-actions">
            <Button variant="secondary" onClick={onAddPrintForm}>
              {t('settings.print.add')}
            </Button>
            <Button
              variant="secondary"
              onClick={onDuplicateSelectedForm}
              disabled={!selectedForm}
            >
              {t('settings.print.duplicate')}
            </Button>
          </div>
        }
        toolbar={
          <label className="field settings-print-document-select">
            <span>{t('settings.print.documentTemplate')}</span>
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
        }
      />

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
