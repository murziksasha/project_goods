import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientHistory } from '../../../entities/client/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { SalesList } from '../../../entities/sale/ui/SalesList';
import { formatCurrency } from '../../../shared/lib/format';

type ClientHistoryPanelProps = {
  history: ClientHistory | null;
  isLoading: boolean;
};

type HistoryPeriod = 'all' | 'year' | 'lastMonth';
type HistoryStats = {
  totalSales: number;
  totalRevenue: number;
  totalItemsSold: number;
};

const emptyHistoryStats: HistoryStats = {
  totalSales: 0,
  totalRevenue: 0,
  totalItemsSold: 0,
};

const filterSalesByPeriod = (sales: Sale[], period: HistoryPeriod) => {
  if (period === 'all') {
    return sales;
  }

  const now = new Date();

  if (period === 'year') {
    return sales.filter(
      (sale) => new Date(sale.saleDate).getFullYear() === now.getFullYear(),
    );
  }

  const monthAgo = new Date(now);
  monthAgo.setMonth(now.getMonth() - 1);

  return sales.filter((sale) => new Date(sale.saleDate) >= monthAgo);
};

const calculateHistoryStats = (sales: Sale[]): HistoryStats =>
  sales.reduce<HistoryStats>(
    (stats, sale) => ({
      totalSales: stats.totalSales + 1,
      totalRevenue: stats.totalRevenue + sale.salePrice * sale.quantity,
      totalItemsSold: stats.totalItemsSold + sale.quantity,
    }),
    emptyHistoryStats,
  );

const ClientHistoryPanelShell = ({
  children,
  header,
  isStacked = false,
}: {
  children: ReactNode;
  header: ReactNode;
  isStacked?: boolean;
}) => (
  <section className="panel">
    <div
      className={
        isStacked ? 'panel-header panel-header-stacked' : 'panel-header'
      }
    >
      {header}
    </div>
    {children}
  </section>
);

const EmptyClientHistoryPanel = ({ message }: { message: string }) => {
  const { t } = useTranslation();

  return (
    <ClientHistoryPanelShell
      header={
        <div>
          <p className="section-label">{t('clients.history.sectionLabel')}</p>
          <h2>{t('clients.history.titleFallback')}</h2>
        </div>
      }
    >
      <p className="empty-state">{message}</p>
    </ClientHistoryPanelShell>
  );
};

const PeriodSelect = ({
  value,
  onChange,
}: {
  value: HistoryPeriod;
  onChange: (value: HistoryPeriod) => void;
}) => {
  const { t } = useTranslation();
  const periodOptions: Array<{ value: HistoryPeriod; labelKey: string }> = [
    { value: 'all', labelKey: 'clients.history.periods.all' },
    { value: 'year', labelKey: 'clients.history.periods.year' },
    { value: 'lastMonth', labelKey: 'clients.history.periods.lastMonth' },
  ];

  return (
    <label className="search-field">
      <span>{t('clients.history.period')}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as HistoryPeriod)}
      >
        {periodOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
};

const HistoryStatsGrid = ({ stats }: { stats: HistoryStats }) => {
  const { t } = useTranslation();

  return (
    <div className="history-stats">
      <div className="metric-card compact">
        <span className="metric-label">{t('clients.history.stats.sales')}</span>
        <strong>{stats.totalSales}</strong>
      </div>
      <div className="metric-card compact">
        <span className="metric-label">
          {t('clients.history.stats.itemsSold')}
        </span>
        <strong>{stats.totalItemsSold}</strong>
      </div>
      <div className="metric-card compact">
        <span className="metric-label">{t('clients.history.stats.revenue')}</span>
        <strong>{formatCurrency(stats.totalRevenue)}</strong>
      </div>
    </div>
  );
};

export const ClientHistoryPanel = ({
  history,
  isLoading,
}: ClientHistoryPanelProps) => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<HistoryPeriod>('all');
  const filteredSales = useMemo(
    () => filterSalesByPeriod(history?.sales ?? [], period),
    [history?.sales, period],
  );
  const filteredStats = useMemo(
    () => calculateHistoryStats(filteredSales),
    [filteredSales],
  );

  if (isLoading) {
    return (
      <EmptyClientHistoryPanel message={t('clients.history.loading')} />
    );
  }

  if (!history) {
    return (
      <EmptyClientHistoryPanel message={t('clients.history.selectClient')} />
    );
  }

  return (
    <ClientHistoryPanelShell
      isStacked
      header={
        <>
          <div className="panel-header-row">
            <div>
              <p className="section-label">{t('clients.history.sectionLabel')}</p>
              <h2>{history.client.name}</h2>
              <p className="panel-subtitle">{history.client.phone}</p>
            </div>
          </div>

          <PeriodSelect value={period} onChange={setPeriod} />
        </>
      }
    >
      <HistoryStatsGrid stats={filteredStats} />

      <SalesList
        sales={filteredSales}
        isLoading={false}
        emptyText={t('clients.history.noPurchases')}
      />
    </ClientHistoryPanelShell>
  );
};