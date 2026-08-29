import { useTranslation } from 'react-i18next';
import { formatCurrencyMetric, type DashboardAnalyticsView } from '../../model/sales-analytics';

type AnalyticsPaymentsSplitProps = {
  metrics: DashboardAnalyticsView['metrics'];
};

export const AnalyticsPaymentsSplit = ({ metrics }: AnalyticsPaymentsSplitProps) => {
  const { t } = useTranslation();
  const total =
    metrics.cashCollected + metrics.nonCashCollected + metrics.unspecifiedCollected;
  const share = (value: number) => (total > 0 ? (value / total) * 100 : 0);

  return (
    <section className="analytics-info-panel">
      <div className="analytics-panel-header">
        <div>
          <p className="section-label">{t('analytics.payments.label')}</p>
          <h2>{t('analytics.payments.title')}</h2>
        </div>
      </div>
      <div className="analytics-payments-bar">
        <span className="analytics-payments-cash" style={{ width: `${share(metrics.cashCollected)}%` }} />
        <span className="analytics-payments-card" style={{ width: `${share(metrics.nonCashCollected)}%` }} />
        {metrics.unspecifiedCollected > 0 ? (
          <span className="analytics-payments-other" style={{ width: `${share(metrics.unspecifiedCollected)}%` }} />
        ) : null}
      </div>
      <div className="analytics-stock-list">
        <div>
          <span>{t('analytics.payments.cash')}</span>
          <strong>{formatCurrencyMetric(metrics.cashCollected)}</strong>
        </div>
        <div>
          <span>{t('analytics.payments.nonCash')}</span>
          <strong>{formatCurrencyMetric(metrics.nonCashCollected)}</strong>
        </div>
        {metrics.unspecifiedCollected > 0 ? (
          <div>
            <span>{t('analytics.payments.unspecified')}</span>
            <strong>{formatCurrencyMetric(metrics.unspecifiedCollected)}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
};
