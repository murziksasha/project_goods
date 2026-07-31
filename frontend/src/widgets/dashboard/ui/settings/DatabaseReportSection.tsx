import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getDbHealth, getDbStats } from '../../../../entities/backup/api/systemDbApi';
import type {
  CollectionStorageStats,
  DatabaseHealth,
  DatabaseStorageStats,
} from '../../../../entities/backup/model/dbReportTypes';

type DatabaseReportSectionProps = {
  canManageBackups: boolean;
};

const READY_STATE_KEYS: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

const formatBytes = (sizeBytes: number) => {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kilobytes = sizeBytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  const megabytes = kilobytes / 1024;
  if (megabytes < 1024) return `${megabytes.toFixed(1)} MB`;
  return `${(megabytes / 1024).toFixed(2)} GB`;
};

const formatCollectedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('uk-UA');
};

const formatUptime = (seconds: number | null, t: TFunction) => {
  if (seconds === null) return t('settings.database.valueUnavailable');
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return t('settings.database.uptimeDaysHours', { days, hours });
  }
  if (hours > 0) {
    return t('settings.database.uptimeHoursMinutes', { hours, minutes });
  }
  return t('settings.database.uptimeMinutes', { minutes });
};

const latencyToneClass = (latencyMs: number | null) => {
  if (latencyMs === null) return 'db-latency-bad';
  if (latencyMs < 50) return 'db-latency-good';
  if (latencyMs < 200) return 'db-latency-warn';
  return 'db-latency-bad';
};

const buildAttention = (collections: CollectionStorageStats[], t: TFunction) => {
  const items: string[] = [];
  const noIndexes = collections
    .filter((item) => item.count > 0 && item.nindexes === 0)
    .map((item) => item.name);
  if (noIndexes.length > 0) {
    items.push(
      t('settings.database.attention.noIndexes', {
        count: noIndexes.length,
        names: noIndexes.slice(0, 5).join(', '),
      }),
    );
  }

  const highRatio = collections.filter((item) => {
    if (item.sizeBytes < 1_000_000) return false;
    const ratio = item.storageSizeBytes / Math.max(item.sizeBytes, 1);
    return ratio >= 3;
  });
  if (highRatio.length > 0) {
    items.push(
      t('settings.database.attention.highStorageRatio', {
        names: highRatio
          .slice(0, 3)
          .map((item) => item.name)
          .join(', '),
      }),
    );
  }

  const largest = [...collections]
    .sort((a, b) => b.storageSizeBytes - a.storageSizeBytes)
    .slice(0, 3)
    .filter((item) => item.storageSizeBytes > 0);
  if (largest.length > 0) {
    items.push(
      t('settings.database.attention.largestCollections', {
        names: largest.map((item) => item.name).join(', '),
      }),
    );
  }

  const emptyCount = collections.filter((item) => item.count === 0).length;
  if (emptyCount > 0) {
    items.push(
      t('settings.database.attention.emptyCollections', { count: emptyCount }),
    );
  }

  return items;
};

export const DatabaseReportSection = ({
  canManageBackups,
}: DatabaseReportSectionProps) => {
  const { t } = useTranslation();
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [stats, setStats] = useState<DatabaseStorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [nextHealth, nextStats] = await Promise.all([
        getDbHealth(),
        getDbStats(),
      ]);
      setHealth(nextHealth);
      setStats(nextStats);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('settings.database.failedLoad'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!canManageBackups) return;
    void refresh();
  }, [canManageBackups, refresh]);

  const sortedCollections = useMemo(() => {
    if (!stats) return [];
    return [...stats.collections].sort(
      (a, b) => b.storageSizeBytes - a.storageSizeBytes,
    );
  }, [stats]);

  const attentionItems = useMemo(
    () => (stats ? buildAttention(stats.collections, t) : []),
    [stats, t],
  );

  const totalDataSize = stats?.totals.dataSizeBytes ?? 0;

  if (!canManageBackups) {
    return (
      <section className="settings-section">
        <p className="empty-state">{t('settings.database.noPermission')}</p>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <div className="panel-header panel-header-row">
        <div>
          <p className="section-label">{t('settings.database.sectionLabel')}</p>
          <h2>{t('settings.database.title')}</h2>
          <p className="panel-subtitle">{t('settings.database.subtitle')}</p>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => void refresh()}
            disabled={isLoading}
          >
            {isLoading
              ? t('settings.database.refreshing')
              : t('settings.database.refresh')}
          </button>
        </div>
      </div>

      {error ? <p className="empty-state">{error}</p> : null}

      {isLoading && !health && !stats ? (
        <p className="empty-state">{t('settings.database.loading')}</p>
      ) : null}

      {health ? (
        <div
          className={`db-health-card db-health-card-${health.status}`}
          aria-label={t('settings.database.healthAriaLabel')}
        >
          <div className="db-health-main">
            <span className={`db-health-badge db-health-badge-${health.status}`}>
              {t(`settings.database.status.${health.status}`)}
            </span>
            <dl className="db-health-meta">
              <div>
                <dt>{t('settings.database.latency')}</dt>
                <dd className={latencyToneClass(health.latencyMs)}>
                  {health.latencyMs === null
                    ? t('settings.database.valueUnavailable')
                    : t('settings.database.latencyValue', {
                        ms: health.latencyMs,
                      })}
                </dd>
              </div>
              <div>
                <dt>{t('settings.database.readyState')}</dt>
                <dd>
                  {t(
                    `settings.database.readyStateLabels.${READY_STATE_KEYS[health.readyState] ?? 'unknown'}`,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('settings.database.version')}</dt>
                <dd>
                  {health.mongoVersion ?? t('settings.database.valueUnavailable')}
                </dd>
              </div>
              <div>
                <dt>{t('settings.database.uptime')}</dt>
                <dd>{formatUptime(health.uptimeSeconds, t)}</dd>
              </div>
              <div>
                <dt>{t('settings.database.connections')}</dt>
                <dd>
                  {health.connections.current === null &&
                  health.connections.available === null
                    ? t('settings.database.valueUnavailable')
                    : t('settings.database.connectionsValue', {
                        current: health.connections.current ?? '—',
                        available: health.connections.available ?? '—',
                      })}
                </dd>
              </div>
              <div>
                <dt>{t('settings.database.dbName')}</dt>
                <dd>
                  {health.dbName ??
                    stats?.dbName ??
                    t('settings.database.valueUnavailable')}
                </dd>
              </div>
              <div>
                <dt>{t('settings.database.collectedAt')}</dt>
                <dd>{formatCollectedAt(health.collectedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {stats ? (
        <>
          <div className="db-kpi-grid" aria-label={t('settings.database.kpisAriaLabel')}>
            <article className="db-kpi-card">
              <span>{t('settings.database.kpis.documents')}</span>
              <strong>{stats.totals.documents.toLocaleString('uk-UA')}</strong>
            </article>
            <article className="db-kpi-card">
              <span>{t('settings.database.kpis.dataSize')}</span>
              <strong>{formatBytes(stats.totals.dataSizeBytes)}</strong>
            </article>
            <article className="db-kpi-card">
              <span>{t('settings.database.kpis.storageSize')}</span>
              <strong>{formatBytes(stats.totals.storageSizeBytes)}</strong>
            </article>
            <article className="db-kpi-card">
              <span>{t('settings.database.kpis.indexSize')}</span>
              <strong>{formatBytes(stats.totals.totalIndexSizeBytes)}</strong>
            </article>
            <article className="db-kpi-card">
              <span>{t('settings.database.kpis.collections')}</span>
              <strong>{stats.collections.length}</strong>
            </article>
          </div>

          {attentionItems.length > 0 ? (
            <div className="db-attention" aria-label={t('settings.database.attention.title')}>
              <p className="section-label">{t('settings.database.attention.title')}</p>
              <ul>
                {attentionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {sortedCollections.length === 0 ? (
            <p className="empty-state">{t('settings.database.collectionsEmpty')}</p>
          ) : (
            <div className="db-collections-wrap">
              <p className="section-label">
                {t('settings.database.collectionsTitle')}
              </p>
              <div className="db-collections-table-scroll">
                <table className="db-collections-table">
                  <thead>
                    <tr>
                      <th>{t('settings.database.table.name')}</th>
                      <th>{t('settings.database.table.documents')}</th>
                      <th>{t('settings.database.table.data')}</th>
                      <th>{t('settings.database.table.storage')}</th>
                      <th>{t('settings.database.table.indexes')}</th>
                      <th>{t('settings.database.table.avgObj')}</th>
                      <th>{t('settings.database.table.indexCount')}</th>
                      <th>{t('settings.database.table.share')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCollections.map((collection) => {
                      const share =
                        totalDataSize > 0
                          ? Math.min(
                              100,
                              (collection.sizeBytes / totalDataSize) * 100,
                            )
                          : 0;
                      return (
                        <tr key={collection.name}>
                          <td>
                            <strong>{collection.name}</strong>
                          </td>
                          <td>{collection.count.toLocaleString('uk-UA')}</td>
                          <td>{formatBytes(collection.sizeBytes)}</td>
                          <td>{formatBytes(collection.storageSizeBytes)}</td>
                          <td>{formatBytes(collection.totalIndexSizeBytes)}</td>
                          <td>{formatBytes(collection.avgObjSizeBytes)}</td>
                          <td>{collection.nindexes}</td>
                          <td>
                            <div className="db-share-cell">
                              <div
                                className="db-share-bar"
                                aria-hidden
                              >
                                <span style={{ width: `${share.toFixed(1)}%` }} />
                              </div>
                              <span>{share.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
};
