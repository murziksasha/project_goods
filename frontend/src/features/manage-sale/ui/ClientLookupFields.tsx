import type { Client } from '../../../entities/client/model/types';

type ClientLookupFieldsProps = {
  clientNameInput: string;
  clientPhoneInput: string;
  clientSuggestions: Client[];
  showClientSuggestions: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPickClient: (client: Client) => void;
  onShowSuggestions: () => void;
  onHideSuggestions: () => void;
};

export const ClientLookupFields = ({
  clientNameInput,
  clientPhoneInput,
  clientSuggestions,
  showClientSuggestions,
  onNameChange,
  onPhoneChange,
  onPickClient,
  onShowSuggestions,
  onHideSuggestions,
}: ClientLookupFieldsProps) => (
  <div className="field field-wide">
    <span>Client</span>
    <div className="form-grid compact-form-grid">
      <label className="field">
        <span>Name</span>
        <input
          value={clientNameInput}
          placeholder="Write client name"
          onFocus={onShowSuggestions}
          onBlur={() => window.setTimeout(onHideSuggestions, 120)}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Phone</span>
        <input
          value={clientPhoneInput}
          placeholder="Write phone number"
          onFocus={onShowSuggestions}
          onBlur={() => window.setTimeout(onHideSuggestions, 120)}
          onChange={(event) => onPhoneChange(event.target.value)}
        />
      </label>
    </div>

    {showClientSuggestions ? (
      <div className="suggestions-panel">
        {clientSuggestions.length > 0 ? (
          clientSuggestions.map((client) => (
            <button
              key={client.id}
              className="suggestion-item"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPickClient(client)}
            >
              <strong>{client.name}</strong>
              <span>{client.phone} • {client.status}</span>
            </button>
          ))
        ) : (
          <p className="suggestion-empty">No matching clients found.</p>
        )}
      </div>
    ) : null}
  </div>
);
