import type { Client } from '../../../entities/client/model/types';
import { formatClientPhonesLabel } from '../../../entities/client/lib/phone-match';

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
}: ClientMergeModalProps) => (
  <div className='modal-backdrop' role='presentation' onClick={onClose}>
    <article
      className='catalog-edit-modal clients-modal'
      role='dialog'
      aria-modal='true'
      onClick={(event) => event.stopPropagation()}
    >
      <header className='catalog-edit-header'>
        <h2>Merge clients</h2>
        <button type='button' className='ghost-button' onClick={onClose}>
          x
        </button>
      </header>
      <div className='catalog-edit-body clients-modal-body'>
        <p className='muted-copy'>
          Select Client 1 and Client 2. Data from Client 2 will be merged into
          Client 1, then Client 2 will be deleted.
        </p>
        <ClientMergeInput
          label='Client 1'
          options={targetOptions}
          query={targetQuery}
          showSuggestions={showTargetSuggestions}
          onQueryChange={(value) => onQueryChange('target', value)}
          onSelectClient={(client) => onSelectClient('target', client)}
        />
        <ClientMergeInput
          label='Client 2'
          options={sourceOptions}
          query={sourceQuery}
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
          {isSaving ? 'Merging...' : 'Merge clients'}
        </button>
      </footer>
    </article>
  </div>
);

const ClientMergeInput = ({
  label,
  options,
  query,
  showSuggestions,
  onQueryChange,
  onSelectClient,
}: {
  label: string;
  options: Client[];
  query: string;
  showSuggestions: boolean;
  onQueryChange: (value: string) => void;
  onSelectClient: (client: Client) => void;
}) => (
  <>
    <label className='field field-wide modal-suggestions-anchor'>
      <span>{label}</span>
      <input
        value={query}
        placeholder='Enter name or phone'
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
