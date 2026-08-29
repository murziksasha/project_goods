import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatCompactMetric,
  formatCurrencyMetric,
  type DashboardAnalyticsView,
} from '../../model/sales-analytics';

type AnalyticsTopItemsPanelProps = {
  items: DashboardAnalyticsView['topLineItems'];
};

const ItemList = ({
  title,
  rows,
}: {
  title: string;
  rows: DashboardAnalyticsView['topLineItems']['products'];
}) => {
  const { t } = useTranslation();
  return (
    <div>
      <p className="metric-label">{title}</p>
      {rows.length === 0 ? (
        <p className="analytics-kpi-sub">{t('analytics.topItems.empty')}</p>
      ) : (
        <ol className="analytics-top-list">
          {rows.map((row) => (
            <li key={row.key}>
              <span>{row.name}</span>
              <strong>
                {formatCompactMetric(row.quantity)} × {formatCurrencyMetric(row.amount)}
              </strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export const AnalyticsTopItemsPanel = ({ items }: AnalyticsTopItemsPanelProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return window.matchMedia('(min-width: 721px)').matches;
  });

  return (
    <section className={`analytics-info-panel analytics-top-items${open ? '' : ' is-collapsed'}`}>
      <div className="analytics-panel-header">
        <div>
          <p className="section-label">{t('analytics.topItems.label')}</p>
          <h2>{t('analytics.topItems.title')}</h2>
        </div>
        <button
          type="button"
          className="analytics-top-toggle"
          onClick={() => setOpen((value) => !value)}
        >
          {t('analytics.topItems.toggle')}
        </button>
      </div>
      <div className="analytics-top-items-body">
        <ItemList title={t('analytics.topItems.products')} rows={items.products} />
        <ItemList title={t('analytics.topItems.services')} rows={items.services} />
      </div>
    </section>
  );
};
