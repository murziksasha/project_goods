import type { ClientFormValues, ClientStatus } from '../types';

type ClientFormProps = {
  form: ClientFormValues;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof ClientFormValues>(
    field: K,
    value: ClientFormValues[K],
  ) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
};

const clientStatuses: ClientStatus[] = ['new', 'ok', 'vip', 'opt', 'blacklist'];

export const ClientForm = ({
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onCancelEdit,
}: ClientFormProps) => (
  <section className="panel">
    <div className="panel-header">
      <div>
        <p className="section-label">Clients</p>
        <h2>{isEditing ? 'Edit client' : 'Add client'}</h2>
      </div>
      {isEditing ? (
        <button className="ghost-button" type="button" onClick={onCancelEdit}>
          Cancel
        </button>
      ) : null}
    </div>

    <div className="form-grid">
      <label className="field">
        <span>Phone</span>
        <input
          value={form.phone}
          placeholder="+380671112233"
          onChange={(event) => onChange('phone', event.target.value)}
        />
      </label>

      <label className="field">
        <span>Name</span>
        <input
          value={form.name}
          placeholder="Ivan Petrenko"
          onChange={(event) => onChange('name', event.target.value)}
        />
      </label>

      <label className="field field-wide">
        <span>Status</span>
        <select
          value={form.status}
          onChange={(event) =>
            onChange('status', event.target.value as ClientStatus)
          }
        >
          {clientStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label className="field field-wide">
        <span>Note</span>
        <textarea
          rows={4}
          value={form.note}
          placeholder="Preferences, warnings, order history..."
          onChange={(event) => onChange('note', event.target.value)}
        />
      </label>
    </div>

    <button
      className="primary-button"
      type="button"
      onClick={onSubmit}
      disabled={isSaving || !form.phone.trim() || !form.name.trim()}
    >
      {isSaving ? 'Saving...' : isEditing ? 'Update client' : 'Add client'}
    </button>
  </section>
);
