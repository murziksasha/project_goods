import { useTranslation } from 'react-i18next';
import type { Client } from '../model/types';
import { getClientStatusLabelKey } from '../model/constants';
import { formatUkrainianPhone } from '../../../shared/lib/phoneFormatter';

type ClientListProps = {
  clients: Client[];
  isLoading: boolean;
  searchQuery: string;
  selectedClientId: string | null;
  onSelect: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
};

export const ClientList = ({
  clients,
  isLoading,
  searchQuery,
  selectedClientId,
  onSelect,
  onEdit,
  onDelete,
}: ClientListProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <p className='empty-state'>{t('clients.table.loading')}</p>;
  }

  if (clients.length === 0) {
    return (
      <p className='empty-state'>
        {searchQuery
          ? t('legacy.clientList.noSearchResults')
          : t('legacy.clientList.empty')}
      </p>
    );
  }

  return (
    <div className='stack-list'>
      {clients.map((client) => (
        <article
          key={client.id}
          className={`list-card ${selectedClientId === client.id ? 'list-card-selected' : ''}`}
          role='button'
          tabIndex={0}
          onClick={() => onSelect(client)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(client);
            }
          }}
        >
          <div className='list-card-row'>
            <div className='card-link'>
              <h3>{client.name}</h3>
              <p>{formatUkrainianPhone(client.phone)}</p>
            </div>
            <span className={`status-pill status-${client.status}`}>
              {t(getClientStatusLabelKey(client.status))}
            </span>
          </div>
          <p className='muted-copy'>
            {client.note || t('legacy.clientList.noNotes')}
          </p>
          <div className='card-actions'>
            <button
              className='ghost-button'
              type='button'
              onClick={(event) => {
                event.stopPropagation();
                onEdit(client);
              }}
            >
              {t('common.edit')}
            </button>
            <button
              className='danger-button'
              type='button'
              onClick={(event) => {
                event.stopPropagation();
                onDelete(client);
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};