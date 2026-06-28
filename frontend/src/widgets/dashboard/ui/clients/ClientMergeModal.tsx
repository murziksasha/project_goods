import { useTranslation } from 'react-i18next';
import type { Client } from '../../../../entities/client/model/types';
import { formatClientPhonesLabel } from '../../../../entities/client/lib/phone-match';

type ClientMergeField = 'target' | 'source';

type ClientMergeModalProps = {
  isSaving: boolean;
  sourceId: string;
  sourceOptions: Client[];
  sourceQuery: string;
  targetId: string;
  targetOptions: Client[];
  targetQuery: string;
  showSourceSuggestions: boolean;
  showTargetSuggestions: boolean;
  onClose: () => void;
  onMerge: () => void;
  onQueryChange: (field: ClientMergeField, value: string) => void;
  onSelectClient: (field: ClientMergeField, client: Client) => void;
};

export const ClientMergeModal = ({
  isSaving,
  sourceId,
  sourceOptions,
  sourceQuery,
  targetId,
  targetOptions,
  targetQuery,
  showSourceSuggestions,
  showTargetSuggestions,
  onClose,
  onMerge,
  onQueryChange,
  onSelectClient,
}: ClientMergeModalProps) => {
  const { t } = useTranslation();

  return (
    <div className='modal-backdrop' role='presentation' onClick={onClose}>
      <article
        className='catalog-edit-modal clients-modal'
        role='dialog'
        aria-modal='true'
        onClick={(event) => event.stopPropagation()}
      >
        <header className='catalog-edit-header'>
          <h2>{t('clients.merge.title')}</h2>
          <button type='button' className='ghost-button' onClick={onClose}>
            x
          </button>
        </header>
        <div className='catalog-edit-body clients-modal-body'>
          <p className='muted-copy'>{t('clients.merge.description')}</p>
          <ClientMergeInput
            label={t('clients.merge.client1')}
            options={targetOptions}
            query={targetQuery}
            searchPlaceholder={t('clients.merge.searchPlaceholder')}
            showSuggestions={showTargetSuggestions}
            onQueryChange={(value) => onQueryChange('target', value)}
            onSelectClient={(client) => onSelectClient('target', client)}
          />
          <ClientMergeInput
            label={t('clients.merge.client2')}
            options={sourceOptions}
            query={sourceQuery}
            searchPlaceholder={t('clients.merge.searchPlaceholder')}
            showSuggestions={showSourceSuggestions}
            onQueryChange={(value) => onQueryChange('source', value)}
            onSelectClient={(client) => onSelectClient('source', client)}
          />
        </div>
        <footer className='catalog-edit-footer'>
          <button
            type='button'
            className='primary-button'
            disabled={
              isSaving || !targetId || !sourceId || targetId === sourceId
            }
            onClick={onMerge}
          >
            {isSaving
              ? t('clients.merge.merging')
              : t('clients.merge.mergeClients')}
          </button>
        </footer>
      </article>
    </div>
  );
};

const ClientMergeInput = ({
  label,
  options,
  query,
  searchPlaceholder,
  showSuggestions,
  onQueryChange,
  onSelectClient,
}: {
  label: string;
  options: Client[];
  query: string;
  searchPlaceholder: string;
  showSuggestions: boolean;
  onQueryChange: (value: string) => void;
  onSelectClient: (client: Client) => void;
}) => (
  <>
    <label className='field field-wide modal-suggestions-anchor'>
      <span>{label}</span>
      <input
        value={query}
        placeholder={searchPlaceholder}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </label>
    {showSuggestions && options.length > 0 ? (
      <div className='suggestions-panel'>
        {options.map((client) => (
          <button
            key={client.id}
            type='button'
            className='suggestion-item'
            onClick={() => onSelectClient(client)}
          >
            <strong>{client.name}</strong>
            <span>{formatClientPhonesLabel(client)}</span>
          </button>
        ))}
      </div>
    ) : null}
  </>
);

export type { ClientMergeField };