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

export const SettingsPanel = ({
  form,
  isSaving,
  onChange,
  onSubmit,
}: SettingsPanelProps) => (
  <section className="panel">
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
  </section>
);
