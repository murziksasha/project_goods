import { useMemo, useState } from 'react';
import type { ClientHistory, Sale } from '../types';
import { SalesList } from './SalesList';

type ClientHistoryPanelProps = {
  history: ClientHistory | null;
  isLoading: boolean;
};

type HistoryPeriod = 'all' | 'year' | 'lastMonth';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 2,
  }).format(value);

const periodOptions: Array<{ value: HistoryPeriod; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'year', label: 'This year' },
  { value: 'lastMonth', label: 'Last month' },
];

const filterSalesByPeriod = (sales: Sale[], period: HistoryPeriod) => {
  if (period === 'all') {
    return sales;
  }

  const now = new Date();

  if (period === 'year') {
    const currentYear = now.getFullYear();
    return sales.filter(
      (sale) => new Date(sale.saleDate).getFullYear() === currentYear,
    );
  }

  const monthAgo = new Date(now);
  monthAgo.setMonth(now.getMonth() - 1);

  return sales.filter((sale) => new Date(sale.saleDate) >= monthAgo);
};

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
    () => ({
      totalSales: filteredSales.length,
      totalRevenue: filteredSales.reduce(
        (sum, sale) => sum + sale.salePrice * sale.quantity,
        0,
      ),
      totalItemsSold: filteredSales.reduce((sum, sale) => sum + sale.quantity, 0),
    }),
    [filteredSales],
  );

  if (isLoading) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="section-label">History</p>
            <h2>Client card</h2>
          </div>
        </div>
        <p className="empty-state">Loading client history...</p>
      </section>
    );
  }

  if (!history) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="section-label">History</p>
            <h2>Client card</h2>
          </div>
        </div>
        <p className="empty-state">Click a client to view all purchases.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header panel-header-stacked">
        <div className="panel-header-row">
          <div>
            <p className="section-label">History</p>
            <h2>{history.client.name}</h2>
            <p className="panel-subtitle">{history.client.phone}</p>
          </div>
        </div>

        <label className="search-field">
          <span>Period</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as HistoryPeriod)}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="history-stats">
        <div className="metric-card compact">
          <span className="metric-label">Sales</span>
          <strong>{filteredStats.totalSales}</strong>
        </div>
        <div className="metric-card compact">
          <span className="metric-label">Items sold</span>
          <strong>{filteredStats.totalItemsSold}</strong>
        </div>
        <div className="metric-card compact">
          <span className="metric-label">Revenue</span>
          <strong>{formatCurrency(filteredStats.totalRevenue)}</strong>
        </div>
      </div>

      <SalesList
        sales={filteredSales}
        isLoading={false}
        emptyText="No purchases found for this period."
      />
    </section>
  );
};
