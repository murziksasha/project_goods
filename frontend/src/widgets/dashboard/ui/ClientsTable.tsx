import type { Client } from '../../../entities/client/model/types';
import {
  getClientStatusClass,
  getClientStatusColor,
  getEffectiveClientStatusLogic,
} from '../../../entities/client/model/constants';
import { formatDateTime } from '../../../shared/lib/format';
import {
  defaultClientStats,
  formatClientIncome,
  type ClientStats,
} from '../model/clients-workspace';

type ClientsTableProps = {
  filteredClientsCount: number;
  isLoading: boolean;
  clients: Client[];
  selectedClientId: string | null;
  statsByClient: Map<string, ClientStats>;
  onDeleteClient: (client: Client) => Promise<void>;
  onOpenClientCard: (clientId: string) => void;
};

export const ClientsTable = ({
  filteredClientsCount,
  isLoading,
  clients,
  selectedClientId,
  statsByClient,
  onDeleteClient,
  onOpenClientCard,
}: ClientsTableProps) => (
  <div className='orders-table-wrap'>
    <table className='orders-table clients-table'>
      <thead>
        <tr>
          <th>Id</th>
          <th>Tag</th>
          <th>Name</th>
          <th>Phone</th>
          <th>Registration date</th>
          <th>Visits</th>
          <th>Client income</th>
          <th aria-label='actions' />
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <tr>
            <td colSpan={8} className='orders-empty'>
              Loading clients...
            </td>
          </tr>
        ) : filteredClientsCount === 0 ? (
          <tr>
            <td colSpan={8} className='orders-empty'>
              No clients found for the selected filters.
            </td>
          </tr>
        ) : (
          clients.map((client) => {
            const stats = statsByClient.get(client.id) ?? defaultClientStats;
            const isActive = selectedClientId === client.id;
            const effectiveStatus = getEffectiveClientStatusLogic(
              client.status || '',
              stats.visits,
            );

            return (
              <tr
                key={client.id}
                className={
                  isActive
                    ? 'clients-table-row clients-table-row-active'
                    : 'clients-table-row'
                }
                onClick={() => onOpenClientCard(client.id)}
              >
                <td data-label='ID'>{client.id.slice(-6)}</td>
                <td data-label='Tag'>
                  <span
                    className={`client-status-badge ${getClientStatusClass(
                      effectiveStatus || '',
                    )}`}
                    style={{
                      backgroundColor: getClientStatusColor(
                        effectiveStatus || '',
                      ),
                      color: 'white',
                    }}
                  >
                    {effectiveStatus || '-'}
                  </span>
                </td>
                <td data-label='Name'>{client.name}</td>
                <td data-label='Phone'>
                  <a
                    href={`tel:${client.phone}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {client.phone}
                  </a>
                </td>
                <td data-label='Registration date'>{formatDateTime(client.createdAt)}</td>
                <td data-label='Visits'>{stats.visits}</td>
                <td data-label='Client income'>{formatClientIncome(stats.income)}</td>
                <td data-label='Actions'>
                  <button
                    type='button'
                    className='clients-delete-button'
                    disabled={stats.visits > 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onDeleteClient(client);
                    }}
                    aria-label={`Delete ${client.name}`}
                    title={
                      stats.visits > 0
                        ? 'Cannot delete a client with orders or sales.'
                        : 'Delete client'
                    }
                  >
                    x
                  </button>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);
