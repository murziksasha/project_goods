import { useTranslation } from 'react-i18next';
import type { Client } from '../../../../entities/client/model/types';
import { formatClientPhonesLabel } from '../../../../entities/client/lib/phone-match';
import { Modal } from '../../../../shared/ui/Modal';
import { Button } from '../../../../shared/ui/Button';

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
    <Modal
      isOpen
      title={t('clients.merge.title')}
      onClose={onClose}
      closeLabel={t('common.close')}
      className="clients-modal"
      bodyClassName="clients-modal-body"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <Button
            variant="primary"
            disabled={
              isSaving || !targetId || !sourceId || targetId === sourceId
            }
            onClick={onMerge}
          >
            {isSaving
              ? t('clients.merge.merging')
              : t('clients.merge.mergeClients')}
          </Button>
        </footer>
      }
    >
      <p className="muted-copy">{t('clients.merge.description')}</p>
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
    </Modal>
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
    <label className="field field-wide modal-suggestions-anchor">
      <span>{label}</span>
      <input
        value={query}
        placeholder={searchPlaceholder}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </label>
    {showSuggestions && options.length > 0 ? (
      <div className="suggestions-panel">
        {options.map((client) => (
          <button
            key={client.id}
            type="button"
            className="suggestion-item"
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
