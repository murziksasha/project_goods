import { clientStatusFilters } from '../../../entities/client/model/constants';
import type { Client, ClientStatus } from '../../../entities/client/model/types';
import { ClientList } from '../../../entities/client/ui/ClientList';

type ClientPanelProps = {
  clients: Client[];
  isLoading: boolean;
  searchQuery: string;
  currentSearchValue: string;
  selectedClientId: string | null;
  statusFilter: ClientStatus | 'all';
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: ClientStatus | 'all') => void;
  onSelect: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
};

export const ClientPanel = ({
  clients,
  isLoading,
  searchQuery,
  currentSearchValue,
  selectedClientId,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onSelect,
  onEdit,
  onDelete,
}: ClientPanelProps) => (
  <section className="panel">
    <div className="panel-header panel-header-stacked">
      <div className="panel-header-row">
        <div>
          <p className="section-label">Clients</p>
          <h2>Client list</h2>
        </div>
      </div>

      <label className="search-field">
        <span>Search by name or phone</span>
        <input
          value={currentSearchValue}
          placeholder="Ivan, +38067..."
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <label className="search-field">
        <span>Filter by status</span>
        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(event.target.value as ClientStatus | 'all')
          }
        >
          {clientStatusFilters.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
    </div>

    <ClientList
      clients={clients}
      isLoading={isLoading}
      searchQuery={searchQuery}
      selectedClientId={selectedClientId}
      onSelect={onSelect}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  </section>
);
