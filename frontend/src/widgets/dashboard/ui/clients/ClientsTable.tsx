import { useTranslation } from 'react-i18next';
import type { Client } from '../../../../entities/client/model/types';
import {
  getClientStatusLabelKey,
  getEffectiveClientStatusLogic,
} from '../../../../entities/client/model/constants';
import { formatDateTime } from '../../../../shared/lib/format';
import { Button } from '../../../../shared/ui/Button';
import { StatusBadge } from '../../../../shared/ui/StatusBadge';
import { TableSkeleton } from '../../../../shared/ui/TableSkeleton';
import { CopyableValue } from '../../../../shared/ui/CopyableValue';
import { PhoneNumber } from '../shared/PhoneNumber';
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
            <th>{t('clients.table.columns.name')}</th>
            <th>{t('clients.table.columns.tag')}</th>
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
              <td colSpan={7} className='orders-empty'>
                <TableSkeleton
                  rows={6}
                  columns={7}
                  label={t('clients.table.loading')}
                />
              </td>
            </tr>
          ) : filteredClientsCount === 0 ? (
            <tr>
              <td colSpan={7} className='orders-empty'>
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
                  <td data-label={t('clients.table.columns.name')}>
                    <CopyableValue value={client.name}>
                      {client.name}
                    </CopyableValue>
                  </td>
                  <td data-label={t('clients.table.columns.tag')}>
                    <StatusBadge
                      clientStatus={effectiveStatus || ''}
                      label={t(getClientStatusLabelKey(effectiveStatus))}
                      title={
                        isBlacklisted
                          ? t('clients.table.blacklistTitle')
                          : undefined
                      }
                    />
                  </td>
                  <td data-label={t('clients.table.columns.phone')}>
                    <CopyableValue value={client.phone}>
                      <a
                        href={`tel:${client.phone}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <PhoneNumber value={client.phone} />
                      </a>
                    </CopyableValue>
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
                    <Button
                      variant='ghost'
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
                      ×
                    </Button>
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
