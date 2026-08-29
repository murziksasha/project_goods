import { useTranslation } from 'react-i18next';
import { formatCurrencyMetric, formatMetric } from '../../model/sales-analytics';

type AnalyticsTodayStripProps = {
  sales: number;
  repairs: number;
  billed: number;
};

export const AnalyticsTodayStrip = ({ sales, repairs, billed }: AnalyticsTodayStripProps) => {
  const { t } = useTranslation();

  return (
    <section className="analytics-today-strip" aria-label={t('analytics.todayStrip')}>
      <span className="metric-label">{t('analytics.todayStrip')}</span>
      <strong>{formatMetric(sales)}</strong>
      <span>{t('analytics.todaySales')}</span>
      <strong>{formatMetric(repairs)}</strong>
      <span>{t('analytics.todayRepairs')}</span>
      <strong>{formatCurrencyMetric(billed)}</strong>
      <span>{t('analytics.todayBilled')}</span>
    </section>
  );
};
