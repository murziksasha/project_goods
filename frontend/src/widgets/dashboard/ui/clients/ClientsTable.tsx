import { useTranslation } from 'react-i18next';
import type { Client } from '../../../../entities/client/model/types';
import {
  getClientStatusClass,
  getClientStatusColor,
  getClientStatusLabelKey,
  getEffectiveClientStatusLogic,
} from '../../../../entities/client/model/constants';
import { formatDateTime } from '../../../../shared/lib/format';
import {
  defaultClientStats,
  formatClientIncome,
  isBlacklistClient,
  type ClientStats,
} from '../../model/clients-workspace';

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
}: ClientsTableProps) => {
  const { t } = useTranslation();

  return (
    <div className='orders-table-wrap'>
      <table className='orders-table clients-table'>
        <thead>
          <tr>
            <th>{t('clients.table.columns.id')}</th>
            <th>{t('clients.table.columns.tag')}</th>
            <th>{t('clients.table.columns.name')}</th>
            <th>{t('clients.table.columns.phone')}</th>
            <th>{t('clients.table.columns.registrationDate')}</th>
            <th>{t('clients.table.columns.visits')}</th>
            <th>{t('clients.table.columns.clientIncome')}</th>
            <th aria-label={t('clients.table.columns.actions')} />
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={8} className='orders-empty'>
                {t('clients.table.loading')}
              </td>
            </tr>
          ) : filteredClientsCount === 0 ? (
            <tr>
              <td colSpan={8} className='orders-empty'>
                {t('clients.table.empty')}
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
              const isBlacklisted = isBlacklistClient(client);
              const rowClassName = [
                'clients-table-row',
                isActive ? 'clients-table-row-active' : '',
                isBlacklisted ? 'clients-table-row-blacklist' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <tr
                  key={client.id}
                  className={rowClassName}
                  title={
                    isBlacklisted
                      ? t('clients.table.blacklistTitle')
                      : undefined
                  }
                  aria-label={
                    isBlacklisted
                      ? t('clients.table.blacklistAriaLabel', {
                          name: client.name,
                        })
                      : undefined
                  }
                  onClick={() => onOpenClientCard(client.id)}
                >
                  <td data-label={t('clients.table.columns.id')}>
                    {client.id.slice(-6)}
                  </td>
                  <td data-label={t('clients.table.columns.tag')}>
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
                      title={
                        isBlacklisted
                          ? t('clients.table.blacklistTitle')
                          : undefined
                      }
                    >
                      {t(getClientStatusLabelKey(effectiveStatus))}
                    </span>
                  </td>
                  <td data-label={t('clients.table.columns.name')}>
                    {client.name}
                  </td>
                  <td data-label={t('clients.table.columns.phone')}>
                    <a
                      href={`tel:${client.phone}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {client.phone}
                    </a>
                  </td>
                  <td data-label={t('clients.table.columns.registrationDate')}>
                    {formatDateTime(client.createdAt)}
                  </td>
                  <td data-label={t('clients.table.columns.visits')}>
                    {stats.visits}
                  </td>
                  <td data-label={t('clients.table.columns.clientIncome')}>
                    {formatClientIncome(stats.income)}
                  </td>
                  <td data-label={t('clients.table.columns.actions')}>
                    <button
                      type='button'
                      className='clients-delete-button'
                      disabled={stats.visits > 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDeleteClient(client);
                      }}
                      aria-label={t('clients.table.deleteAriaLabel', {
                        name: client.name,
                      })}
                      title={
                        stats.visits > 0
                          ? t('clients.table.deleteDisabledTitle')
                          : t('clients.table.deleteTitle')
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
};
