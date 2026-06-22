import type { Client } from '../model/types';
import {
  getClientStatusClass,
  getClientStatusColor,
  getEffectiveClientStatusLogic,
} from '../model/constants';
import { formatUkrainianPhone } from '../../../shared/lib/phoneFormatter';
import type { ClientStats } from '../../../widgets/dashboard/model/clients-workspace';
import { defaultClientStats } from '../../../widgets/dashboard/model/clients-workspace';

type ClientListProps = {
  clients: Client[];
  isLoading: boolean;
  searchQuery: string;
  selectedClientId: string | null;
  statsByClient?: Map<string, ClientStats>;
  onSelect: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
};

export const ClientList = ({
  clients,
  isLoading,
  searchQuery,
  selectedClientId,
  statsByClient,
  onSelect,
  onEdit,
  onDelete,
}: ClientListProps) => {
  if (isLoading) {
    return <p className='empty-state'>Loading clients...</p>;
  }

  if (clients.length === 0) {
    return (
      <p className='empty-state'>
        {searchQuery
          ? 'No clients found for this search query.'
          : 'No clients yet.'}
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
            {(() => {
              const stats = statsByClient?.get(client.id) ?? defaultClientStats;
              const effectiveStatus = getEffectiveClientStatusLogic(
                client.status || '',
                stats.visits,
              );
              return (
                <span
                  className={`status-pill ${getClientStatusClass(effectiveStatus || '')}`}
                  style={{
                    backgroundColor: getClientStatusColor(effectiveStatus || ''),
                    color: 'white',
                  }}
                >
                  {effectiveStatus || '-'}
                </span>
              );
            })()}
          </div>
          <p className='muted-copy'>
            {client.note || 'No notes yet.'}
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
              Edit
            </button>
            <button
              className='danger-button'
              type='button'
              onClick={(event) => {
                event.stopPropagation();
                onDelete(client);
              }}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};
