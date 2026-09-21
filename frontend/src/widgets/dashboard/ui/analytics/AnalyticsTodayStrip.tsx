import type React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrencyMetric, formatMetric } from '../../model/sales-analytics';

export interface AnalyticsTodayStripProps {
  sales: number;
  repairs: number;
  billed: number;
};

export const AnalyticsTodayStrip: React.FC<AnalyticsTodayStripProps> = ({ sales, repairs, billed }) => {
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
