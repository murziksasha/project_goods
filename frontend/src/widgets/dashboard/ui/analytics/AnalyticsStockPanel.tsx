import { useTranslation } from 'react-i18next';
import {
  formatCurrencyMetric,
  formatMetric,
  type DashboardAnalyticsView,
} from '../../model/sales-analytics';

type AnalyticsStockPanelProps = {
  stock: DashboardAnalyticsView['stock'];
};

export const AnalyticsStockPanel = ({ stock }: AnalyticsStockPanelProps) => {
  const { t } = useTranslation();
  const total = Math.max(stock.totalStock, 1);
  const freePct = (stock.freeStock / total) * 100;
  const reservedPct = (stock.reservedStock / total) * 100;

  return (
    <section className="analytics-info-panel">
      <div className="analytics-panel-header">
        <div>
          <p className="section-label">{t('analytics.stock')}</p>
          <h2>{t('analytics.inventoryHealth')}</h2>
          <p className="analytics-kpi-hint">{t('analytics.currentSnapshot')}</p>
        </div>
      </div>
      <div className="analytics-stock-meter" aria-hidden>
        <span className="analytics-stock-free" style={{ width: `${freePct}%` }} />
        <span className="analytics-stock-reserved" style={{ width: `${reservedPct}%` }} />
      </div>
      <div className="analytics-stock-list">
        <div>
          <span>{t('analytics.products')}</span>
          <strong>{formatMetric(stock.productCount)}</strong>
        </div>
        <div>
          <span>{t('analytics.freeStock')}</span>
          <strong>{formatMetric(stock.freeStock)}</strong>
        </div>
        <div>
          <span>{t('analytics.reserved')}</span>
          <strong>{formatMetric(stock.reservedStock)}</strong>
        </div>
        <div>
          <span>{t('analytics.stockValue')}</span>
          <strong>{formatCurrencyMetric(stock.stockValue)}</strong>
        </div>
      </div>
    </section>
  );
};
