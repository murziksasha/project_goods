import type { Client } from '../types';

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
  if (isLoading) {
    return <p className="empty-state">Loading clients...</p>;
  }

  if (clients.length === 0) {
    return (
      <p className="empty-state">
        {searchQuery ? 'No clients found for this search query.' : 'No clients yet.'}
      </p>
    );
  }

  return (
    <div className="stack-list">
      {clients.map((client) => (
        <article
          key={client.id}
          className={`list-card ${selectedClientId === client.id ? 'list-card-selected' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(client)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(client);
            }
          }}
        >
          <div className="list-card-row">
            <div className="card-link">
              <h3>{client.name}</h3>
              <p>{client.phone}</p>
            </div>
            <span className={`status-pill status-${client.status}`}>
              {client.status}
            </span>
          </div>
          <p className="muted-copy">{client.note || 'No notes yet.'}</p>
          <div className="card-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(client);
              }}
            >
              Edit
            </button>
            <button
              className="danger-button"
              type="button"
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
