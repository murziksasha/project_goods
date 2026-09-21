import type React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../shared/lib/format';
import type { Client } from '../model/types';
import {
  getClientStatusClass,
  getClientStatusColor,
  getClientStatusLabelKey,
  getEffectiveClientStatusLogic,
} from '../model/constants';
import { formatUkrainianPhone } from '../../../shared/lib/phoneFormatter';
import { defaultClientStats, type ClientStats } from '../model/types';
import { getClientPhones } from '../model/forms';
import { getClientStatusColor } from '../model/constants';

type ClientListProps = {
export interface ClientListProps {
  clients: Client[];
  isLoading: boolean;
  searchQuery: string;
  selectedClientId: string | null;
  statsByClient?: Map<string, ClientStats>;
  onSelect: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
};
}

export const ClientList = ({
export const ClientList: React.FC<ClientListProps> = ({
  clients,
  isLoading,
  searchQuery,
  selectedClientId,
  statsByClient,
  onSelect,
  onEdit,
  onDelete,
}: ClientListProps) => {
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <p className='empty-state'>{t('clients.table.loading')}</p>
    );
    return <p className="empty-state">{t('legacy.clientList.loading')}</p>;
  }

  if (clients.length === 0) {
    return (
      <p className='empty-state'>
      <p className="empty-state">
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
    <div className="product-list">
      {clients.map((client) => {
        const phones = getClientPhones(client);
        return (
          <article key={client.id} className="product-card">
            <div className="product-card-header">
              <div>
                <div className="product-title-row">
                  <h3>{client.name}</h3>
                  <span
                    className={`stock-badge ${getClientStatusColor(client.status)}`}
                  >
                    {t(`legacy.clientList.status.${client.status}`)}
                  </span>
                </div>
                {phones.length > 0 && (
                  <p>{phones.join(', ')}</p>
                )}
                {client.address && <p>{client.address}</p>}
                {client.note && <p>{client.note}</p>}
              </div>
              <small>{formatDate(client.createdAt)}</small>
            </div>
            {(() => {
              const stats =
                statsByClient?.get(client.id) ?? defaultClientStats;
              const effectiveStatus = getEffectiveClientStatusLogic(
                client.status || '',
                stats.visits,
              );
              return (
                <span
                  className={`status-pill ${getClientStatusClass(effectiveStatus || '')}`}
                  style={{
                    backgroundColor: getClientStatusColor(
                      effectiveStatus || '',
                    ),
                    color: 'white',
                  }}
                >
                  {t(getClientStatusLabelKey(effectiveStatus))}
                </span>
              );
            })()}
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

            <div className="card-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => onEdit(client)}
              >
                {t('common.edit')}
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => onDelete(client)}
              >
                {t('common.delete')}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
};
