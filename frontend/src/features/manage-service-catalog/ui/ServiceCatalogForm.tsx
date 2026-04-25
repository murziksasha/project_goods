import type { ServiceCatalogFormValues } from '../../../entities/service-catalog/model/types';
import { NumberStepper } from '../../../shared/ui/NumberStepper';

type ServiceCatalogFormProps = {
  form: ServiceCatalogFormValues;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof ServiceCatalogFormValues>(
    field: K,
    value: ServiceCatalogFormValues[K],
  ) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
};

const hasEmptyRequiredFields = (form: ServiceCatalogFormValues) =>
  !form.name.trim() || !form.price.trim();

export const ServiceCatalogForm = ({
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onCancelEdit,
}: ServiceCatalogFormProps) => (
  <section className="panel">
    <div className="panel-header">
      <div>
        <p className="section-label">{isEditing ? 'Update' : 'Create'}</p>
        <h2>{isEditing ? 'Edit service' : 'Add service'}</h2>
      </div>
      {isEditing ? (
        <button className="ghost-button" type="button" onClick={onCancelEdit}>
          Cancel
        </button>
      ) : null}
    </div>

    <div className="form-grid">
      <label className="field">
        <span>Name</span>
        <input
          value={form.name}
          placeholder="Software setup"
          onChange={(event) => onChange('name', event.target.value)}
        />
      </label>

      <label className="field">
        <span>Price</span>
        <NumberStepper
          min={0}
          value={form.price}
          placeholder="700"
          onChange={(value) => onChange('price', value)}
        />
      </label>

      <label className="field field-wide">
        <span>Note</span>
        <textarea
          rows={3}
          value={form.note}
          placeholder="Default description or internal note"
          onChange={(event) => onChange('note', event.target.value)}
        />
      </label>
    </div>

    <button
      className="primary-button"
      type="button"
      onClick={onSubmit}
      disabled={isSaving || hasEmptyRequiredFields(form)}
    >
      {isSaving ? 'Saving...' : isEditing ? 'Update service' : 'Add service'}
    </button>
  </section>
);
