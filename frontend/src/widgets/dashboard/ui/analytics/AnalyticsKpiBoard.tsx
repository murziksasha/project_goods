import { useTranslation } from 'react-i18next';
import {
  formatCurrencyMetric,
  formatDeltaPct,
  formatMetric,
  type DashboardAnalyticsView,
} from '../../model/sales-analytics';
import { AnalyticsSparkline } from './AnalyticsSparkline';

type AnalyticsKpiBoardProps = {
  analytics: DashboardAnalyticsView;
  previousLabel: string;
};

const DeltaChip = ({ value }: { value: number | null | undefined }) => {
  const formatted = formatDeltaPct(value ?? null);
  if (!formatted) return null;
  const tone = (value ?? 0) > 0 ? 'up' : (value ?? 0) < 0 ? 'down' : 'flat';
  return <span className={`analytics-delta analytics-delta-${tone}`}>{formatted}</span>;
};

export const AnalyticsKpiBoard = ({ analytics, previousLabel }: AnalyticsKpiBoardProps) => {
  const { t } = useTranslation();
  const { metrics } = analytics;
  const billedValues = analytics.revenueSnapshots[0]?.values ?? [];
  const coverage = Math.max(0, Math.min(100, metrics.paymentCoverage));
  const vsLabel = t('analytics.delta.vs', { label: previousLabel });

  return (
    <div className="analytics-kpi-board">
      <div className="analytics-kpi-money">
        <article className="analytics-kpi-card analytics-kpi-card-hero">
          <div className="analytics-kpi-card-top">
            <span className="metric-label">{t('analytics.summary.billed')}</span>
            <DeltaChip value={metrics.deltas?.billedPct} />
          </div>
          <strong>{formatCurrencyMetric(metrics.billed)}</strong>
          <p className="analytics-kpi-sub">
            {t('analytics.summary.productBilled')} {formatCurrencyMetric(metrics.productRevenue)}
            {' · '}
            {t('analytics.summary.repairBilled')} {formatCurrencyMetric(metrics.repairRevenue)}
          </p>
          {metrics.deltas ? <p className="analytics-kpi-hint">{vsLabel}</p> : null}
          <AnalyticsSparkline values={billedValues} />
        </article>

        <article className="analytics-kpi-card analytics-kpi-card-hero">
          <div className="analytics-kpi-card-top">
            <span className="metric-label">{t('analytics.summary.collected')}</span>
            <DeltaChip value={metrics.deltas?.collectedPct} />
          </div>
          <strong className="analytics-kpi-good">{formatCurrencyMetric(metrics.paidAmount)}</strong>
          <div className="analytics-coverage" aria-label={t('analytics.summary.coverage')}>
            <span style={{ width: `${coverage}%` }} />
          </div>
          <p className="analytics-kpi-sub">
            {t('analytics.summary.coverage')} {formatMetric(coverage)}%
          </p>
        </article>

        <article className="analytics-kpi-card analytics-kpi-card-hero">
          <div className="analytics-kpi-card-top">
            <span className="metric-label">{t('analytics.summary.receivables')}</span>
          </div>
          <strong className="analytics-kpi-risk">{formatCurrencyMetric(metrics.remainingAmount)}</strong>
          <p className="analytics-kpi-sub">
            {formatMetric(metrics.unpaidOrders)} {t('analytics.signalsLabels.unpaidOrders')}
          </p>
        </article>
      </div>

      <div className="analytics-kpi-volume">
        <article className="analytics-kpi-card">
          <div className="analytics-kpi-card-top">
            <span className="metric-label">{t('analytics.summary.sales')}</span>
            <DeltaChip value={metrics.deltas?.salesPct} />
          </div>
          <strong>{formatMetric(metrics.salesCount)}</strong>
          {metrics.rapidSaleCount > 0 ? (
            <p className="analytics-kpi-sub">
              {formatMetric(metrics.rapidSaleCount)} {t('analytics.summary.rapidSales')}
            </p>
          ) : null}
        </article>
        <article className="analytics-kpi-card">
          <div className="analytics-kpi-card-top">
            <span className="metric-label">{t('analytics.summary.repairOrders')}</span>
            <DeltaChip value={metrics.deltas?.ordersPct} />
          </div>
          <strong>{formatMetric(metrics.ordersCount)}</strong>
        </article>
        <article className="analytics-kpi-card">
          <span className="metric-label">{t('analytics.summary.productTicket')}</span>
          <strong>{formatCurrencyMetric(metrics.productAverageTicket)}</strong>
        </article>
        <article className="analytics-kpi-card">
          <span className="metric-label">{t('analytics.summary.repairTicket')}</span>
          <strong>{formatCurrencyMetric(metrics.repairAverageTicket)}</strong>
        </article>
      </div>
    </div>
  );
};
