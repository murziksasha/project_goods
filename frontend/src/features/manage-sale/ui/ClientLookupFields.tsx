import { useTranslation } from 'react-i18next';
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
}: ClientLookupFieldsProps) => {
  const { t } = useTranslation();

  return (
    <div className="field field-wide modal-suggestions-anchor">
      <span>{t('legacy.saleForm.lookup.client')}</span>
      <div className="form-grid compact-form-grid">
        <label className="field">
          <span>{t('legacy.saleForm.lookup.name')}</span>
          <input
            value={clientNameInput}
            placeholder={t('legacy.saleForm.lookup.clientPlaceholder')}
            onFocus={onShowSuggestions}
            onBlur={() => window.setTimeout(onHideSuggestions, 120)}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>

        <label className="field">
          <span>{t('legacy.saleForm.lookup.phone')}</span>
          <input
            value={clientPhoneInput}
            placeholder={t('legacy.saleForm.lookup.phonePlaceholder')}
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
                onClick={() => {
                  onPickClient(client);
                  onHideSuggestions();
                }}
              >
                <strong>{client.name}</strong>
                <span>
                  {client.phone} • {client.status}
                </span>
              </button>
            ))
          ) : (
            <p className="suggestion-empty">{t('legacy.saleForm.lookup.noClientsFound')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
};