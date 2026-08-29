import { useTranslation } from 'react-i18next';
import { formatMetric, type DashboardAnalyticsView } from '../../model/sales-analytics';

const FUNNEL_COLORS: Record<string, string> = {
  new: '#94a3b8',
  diagnostics: '#38bdf8',
  waitingParts: '#f59e0b',
  clientApproved: '#818cf8',
  inRepair: '#2d8ae3',
  refinement: '#14b8a6',
  ready: '#10b981',
  paid: '#0ea47d',
  other: '#64748b',
};

type AnalyticsFunnelPanelProps = {
  funnel: DashboardAnalyticsView['funnel'];
};

export const AnalyticsFunnelPanel = ({ funnel }: AnalyticsFunnelPanelProps) => {
  const { t } = useTranslation();
  const total = funnel.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="analytics-info-panel">
      <div className="analytics-panel-header">
        <div>
          <p className="section-label">{t('analytics.funnel.label')}</p>
          <h2>{t('analytics.funnel.title')}</h2>
        </div>
      </div>
      <div className="analytics-funnel-bar" aria-label={t('analytics.funnel.title')}>
        {funnel.map((item) =>
          item.count > 0 ? (
            <span
              key={item.status}
              style={{
                width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
                backgroundColor: FUNNEL_COLORS[item.status] ?? FUNNEL_COLORS.other,
              }}
              title={`${item.status}: ${item.count}`}
            />
          ) : null,
        )}
      </div>
      {total === 0 ? (
        <p className="analytics-kpi-sub">{t('analytics.noOrdersForPeriod')}</p>
      ) : (
      <div className="analytics-funnel-legend">
        {funnel.filter((item) => item.count > 0).map((item) => (
          <div key={item.status}>
            <span
              className="chart-legend-swatch"
              style={{ backgroundColor: FUNNEL_COLORS[item.status] ?? FUNNEL_COLORS.other }}
            />
            <span>
              {item.status === 'other'
                ? t('analytics.funnel.other')
                : t(`orders.status.repair.${item.status}`, { defaultValue: item.status })}
            </span>
            <strong>{formatMetric(item.count)}</strong>
          </div>
        ))}
      </div>
      )}
    </section>
  );
};
