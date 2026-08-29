import { useTranslation } from 'react-i18next';
import { formatMetric, type DashboardAnalyticsView } from '../../model/sales-analytics';

type AnalyticsOperationsPanelProps = {
  operations: DashboardAnalyticsView['operations'];
};

export const AnalyticsOperationsPanel = ({ operations }: AnalyticsOperationsPanelProps) => {
  const { t } = useTranslation();

  return (
    <section className="analytics-info-panel">
      <div className="analytics-panel-header">
        <div>
          <p className="section-label">{t('analytics.workflow')}</p>
          <h2>{t('analytics.operationalPulse')}</h2>
        </div>
      </div>
      <div className="analytics-mini-grid">
        <div>
          <span className="metric-label">{t('analytics.openNow')}</span>
          <strong>{formatMetric(operations.openOrders)}</strong>
        </div>
        <div>
          <span className="metric-label">{t('analytics.ready')}</span>
          <strong>{formatMetric(operations.readyCount)}</strong>
        </div>
        <div>
          <span className="metric-label">{t('analytics.waitingParts')}</span>
          <strong>{formatMetric(operations.waitingPartsCount)}</strong>
        </div>
        <div>
          <span className="metric-label">{t('analytics.closedInPeriod')}</span>
          <strong>{formatMetric(operations.closedOrders)}</strong>
        </div>
      </div>
    </section>
  );
};
