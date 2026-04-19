import type { Client } from '../types';

type ClientListProps = {
  clients: Client[];
  isLoading: boolean;
  selectedClientId: string | null;
  onSelect: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
};

export const ClientList = ({
  clients,
  isLoading,
  selectedClientId,
  onSelect,
  onEdit,
  onDelete,
}: ClientListProps) => {
  if (isLoading) {
    return <p className="empty-state">Loading clients...</p>;
  }

  if (clients.length === 0) {
    return <p className="empty-state">No clients yet.</p>;
  }

  return (
    <div className="stack-list">
      {clients.map((client) => (
        <article
          key={client.id}
          className={`list-card ${selectedClientId === client.id ? 'list-card-selected' : ''}`}
        >
          <div className="list-card-row">
            <button
              className="card-link"
              type="button"
              onClick={() => onSelect(client)}
            >
              <h3>{client.name}</h3>
              <p>{client.phone}</p>
            </button>
            <span className={`status-pill status-${client.status}`}>
              {client.status}
            </span>
          </div>
          <p className="muted-copy">{client.note || 'No notes yet.'}</p>
          <div className="card-actions">
            <button className="ghost-button" type="button" onClick={() => onEdit(client)}>
              Edit
            </button>
            <button className="danger-button" type="button" onClick={() => onDelete(client)}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};
