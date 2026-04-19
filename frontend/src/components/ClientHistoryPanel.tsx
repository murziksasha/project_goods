import type { ClientHistory } from '../types';
import { SalesList } from './SalesList';

type ClientHistoryPanelProps = {
  history: ClientHistory | null;
  isLoading: boolean;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 2,
  }).format(value);

export const ClientHistoryPanel = ({
  history,
  isLoading,
}: ClientHistoryPanelProps) => {
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
        <p className="empty-state">Select a client to view their purchase history.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="section-label">History</p>
          <h2>{history.client.name}</h2>
          <p className="panel-subtitle">{history.client.phone}</p>
        </div>
      </div>

      <div className="history-stats">
        <div className="metric-card compact">
          <span className="metric-label">Sales</span>
          <strong>{history.stats.totalSales}</strong>
        </div>
        <div className="metric-card compact">
          <span className="metric-label">Items sold</span>
          <strong>{history.stats.totalItemsSold}</strong>
        </div>
        <div className="metric-card compact">
          <span className="metric-label">Revenue</span>
          <strong>{formatCurrency(history.stats.totalRevenue)}</strong>
        </div>
      </div>

      <SalesList
        sales={history.sales}
        isLoading={false}
        emptyText="This client has no sales yet."
      />
    </section>
  );
};
