import { useTranslation } from 'react-i18next';
import { formatCurrencyMetric, type DashboardAnalyticsView } from '../../model/sales-analytics';

type AnalyticsSignalsPanelProps = {
  analytics: DashboardAnalyticsView;
};

export const AnalyticsSignalsPanel = ({ analytics }: AnalyticsSignalsPanelProps) => {
  const { t } = useTranslation();

  return (
    <section className="analytics-info-panel">
      <div className="analytics-panel-header">
        <div>
          <p className="section-label">{t('analytics.signals')}</p>
          <h2>{t('analytics.attentionQueue')}</h2>
        </div>
      </div>
      <div className="analytics-signal-list">
        {analytics.signals.map((signal) => (
          <div key={signal.labelKey} className={`analytics-signal analytics-signal-${signal.tone}`}>
            <span>{t(signal.labelKey)}</span>
            <strong>{signal.value}</strong>
          </div>
        ))}
        <div
          className={`analytics-signal ${analytics.operations.unpaidAmount > 0 ? 'analytics-signal-risk' : 'analytics-signal-good'}`}
        >
          <span>{t('analytics.unpaidAmount')}</span>
          <strong>{formatCurrencyMetric(analytics.operations.unpaidAmount)}</strong>
        </div>
      </div>
    </section>
  );
};
