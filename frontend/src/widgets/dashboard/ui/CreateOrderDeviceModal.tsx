type CreateOrderDeviceModalProps = {
  name: string;
  isActive: boolean;
  isSaving: boolean;
  canSave: boolean;
  onNameChange: (value: string) => void;
  onIsActiveChange: (value: boolean) => void;
  onClose: () => void;
  onSave: () => void;
};

export const CreateOrderDeviceModal = ({
  name,
  isActive,
  isSaving,
  canSave,
  onNameChange,
  onIsActiveChange,
  onClose,
  onSave,
}: CreateOrderDeviceModalProps) => (
  <div className="modal-backdrop" role="presentation">
    <section className="catalog-edit-modal" role="dialog" aria-modal="true">
      <header className="catalog-edit-header">
        <div className="catalog-edit-title">
          <h2>Create device</h2>
        </div>
        <button
          type="button"
          className="create-order-close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
      </header>
      <div className="catalog-edit-body">
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Device name"
          />
        </label>
        <label className="create-inline-checkbox">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => onIsActiveChange(event.target.checked)}
          />
          <span>Activity</span>
        </label>
      </div>
      <footer className="catalog-edit-footer">
        <button type="button" className="secondary-button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={isSaving || !canSave}
          onClick={onSave}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </footer>
    </section>
  </div>
);
