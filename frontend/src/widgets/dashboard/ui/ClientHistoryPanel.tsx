import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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

const periodOptions: Array<{ value: HistoryPeriod; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'year', label: 'This year' },
  { value: 'lastMonth', label: 'Last month' },
];

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

const EmptyClientHistoryPanel = ({ message }: { message: string }) => (
  <ClientHistoryPanelShell
    header={
      <div>
        <p className="section-label">History</p>
        <h2>Client card</h2>
      </div>
    }
  >
    <p className="empty-state">{message}</p>
  </ClientHistoryPanelShell>
);

const PeriodSelect = ({
  value,
  onChange,
}: {
  value: HistoryPeriod;
  onChange: (value: HistoryPeriod) => void;
}) => (
  <label className="search-field">
    <span>Period</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as HistoryPeriod)}
    >
      {periodOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const HistoryStatsGrid = ({ stats }: { stats: HistoryStats }) => (
  <div className="history-stats">
    <div className="metric-card compact">
      <span className="metric-label">Sales</span>
      <strong>{stats.totalSales}</strong>
    </div>
    <div className="metric-card compact">
      <span className="metric-label">Items sold</span>
      <strong>{stats.totalItemsSold}</strong>
    </div>
    <div className="metric-card compact">
      <span className="metric-label">Revenue</span>
      <strong>{formatCurrency(stats.totalRevenue)}</strong>
    </div>
  </div>
);

export const ClientHistoryPanel = ({
  history,
  isLoading,
}: ClientHistoryPanelProps) => {
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
    return <EmptyClientHistoryPanel message="Loading client history..." />;
  }

  if (!history) {
    return (
      <EmptyClientHistoryPanel message="Click a client to view all purchases." />
    );
  }

  return (
    <ClientHistoryPanelShell
      isStacked
      header={
        <>
          <div className="panel-header-row">
            <div>
              <p className="section-label">History</p>
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
        emptyText="No purchases found for this period."
      />
    </ClientHistoryPanelShell>
  );
};
