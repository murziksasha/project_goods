import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardPreferences } from '../../../../entities/settings/model/types';
import type { Product } from '../../../../entities/product/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import { useDashboardAnalyticsQuery } from '../../../../entities/analytics/api/analyticsApi';
import {
  getAnalyticsDateRangeFilterCount,
  type AnalyticsDateRange,
} from '../../model/analytics-date-range';
import {
  adaptDashboardAnalyticsResponse,
  buildDashboardAnalytics,
} from '../../model/sales-analytics';
import type { StatsPeriod } from '../../model/stats-period';
import { AnalyticsDateFilterPanel } from './AnalyticsDateFilterPanel';
import { StatsPeriodToggle } from './StatsPeriodToggle';
import { MarketWeatherWidget } from '../weather/MarketWeatherWidget';
import { AnalyticsKpiBoard } from './AnalyticsKpiBoard';
import { AnalyticsTodayStrip } from './AnalyticsTodayStrip';
import { AnalyticsChartPanel } from './AnalyticsChartPanel';
import { AnalyticsFunnelPanel } from './AnalyticsFunnelPanel';
import { AnalyticsPaymentsSplit } from './AnalyticsPaymentsSplit';
import { AnalyticsOperationsPanel } from './AnalyticsOperationsPanel';
import { AnalyticsStockPanel } from './AnalyticsStockPanel';
import { AnalyticsSignalsPanel } from './AnalyticsSignalsPanel';
import { AnalyticsTopItemsPanel } from './AnalyticsTopItemsPanel';

type AnalyticsHeroSectionProps = {
  sales: Sale[];
  orders: Sale[];
  products: Product[];
  isSalesLoading: boolean;
  isSeeding: boolean;
  canEraseAllData: boolean;
  statsPeriod: StatsPeriod;
  analyticsDateRange: AnalyticsDateRange | null;
  draftAnalyticsDateRange: AnalyticsDateRange;
  isAnalyticsDateFilterOpen: boolean;
  dashboardPreferences: DashboardPreferences;
  onStatsPeriodChange: (value: StatsPeriod) => void;
  onDraftAnalyticsDateRangeChange: (value: AnalyticsDateRange) => void;
  onAnalyticsDateFilterOpenChange: (value: boolean) => void;
  onApplyAnalyticsDateRange: () => void;
  onClearAnalyticsDateRange: () => void;
  onSeed: () => void;
};

const previousLabelForPeriod = (period: StatsPeriod, hasCustomRange: boolean, t: (key: string) => string) => {
  if (hasCustomRange) return t('analytics.delta.previousPeriod');
  if (period === 'today') return t('analytics.delta.yesterday');
  return t('analytics.delta.previousPeriod');
};

export const AnalyticsHeroSection = ({
  sales,
  orders,
  products,
  isSalesLoading,
  isSeeding,
  canEraseAllData,
  statsPeriod,
  analyticsDateRange,
  draftAnalyticsDateRange,
  isAnalyticsDateFilterOpen,
  dashboardPreferences,
  onStatsPeriodChange,
  onDraftAnalyticsDateRangeChange,
  onAnalyticsDateFilterOpenChange,
  onApplyAnalyticsDateRange,
  onClearAnalyticsDateRange,
  onSeed,
}: AnalyticsHeroSectionProps) => {
  const { t } = useTranslation();
  const serverQuery = useDashboardAnalyticsQuery(true, statsPeriod, analyticsDateRange);
  const localAnalytics = useMemo(
    () =>
      buildDashboardAnalytics(
        sales,
        orders,
        statsPeriod,
        products,
        new Date(),
        analyticsDateRange,
      ),
    [sales, orders, statsPeriod, products, analyticsDateRange],
  );
  const analytics = serverQuery.data
    ? adaptDashboardAnalyticsResponse(serverQuery.data)
    : localAnalytics;
  const isAnalyticsLoading = serverQuery.isLoading || (isSalesLoading && !serverQuery.data);
  const dateFilterCount = getAnalyticsDateRangeFilterCount(analyticsDateRange);
  const hasCustomDateRange = Boolean(analyticsDateRange?.dateFrom || analyticsDateRange?.dateTo);
  const previousLabel = previousLabelForPeriod(statsPeriod, hasCustomDateRange, t);

  return (
    <section className="analytics-dashboard">
      {dashboardPreferences.marketWeatherEnabled ? (
        <div className="analytics-live-insights">
          <MarketWeatherWidget dashboardPreferences={dashboardPreferences} />
        </div>
      ) : null}

      <div className="analytics-executive-header">
        <div>
          <p className="section-label">{t('analytics.executiveDashboard')}</p>
          <h1>{t('analytics.businessPerformance')}</h1>
          <p className="hero-chart-note">
            {t('analytics.heroNote', { period: analytics.detailLabel })}
          </p>
        </div>
        <div className="hero-controls">
          <StatsPeriodToggle
            statsPeriod={statsPeriod}
            hasCustomDateRange={hasCustomDateRange}
            onChange={onStatsPeriodChange}
          />
          <button
            type="button"
            className="toolbar-filter-button toolbar-filter-toggle-button"
            aria-expanded={isAnalyticsDateFilterOpen}
            onClick={() => onAnalyticsDateFilterOpenChange(!isAnalyticsDateFilterOpen)}
          >
            {t('analytics.dateFilter.date')}
            {dateFilterCount > 0 ? (
              <span className="toolbar-filter-count">{dateFilterCount}</span>
            ) : null}
          </button>
          {canEraseAllData ? (
            <button className="secondary-button" type="button" onClick={onSeed} disabled={isSeeding}>
              {isSeeding ? t('analytics.loading') : t('analytics.eraseAllData')}
            </button>
          ) : null}
        </div>
      </div>

      <AnalyticsDateFilterPanel
        draftRange={draftAnalyticsDateRange}
        isOpen={isAnalyticsDateFilterOpen}
        onDraftRangeChange={onDraftAnalyticsDateRangeChange}
        onApply={onApplyAnalyticsDateRange}
        onClear={onClearAnalyticsDateRange}
        onClose={() => onAnalyticsDateFilterOpenChange(false)}
      />

      <AnalyticsKpiBoard analytics={analytics} previousLabel={previousLabel} />
      <AnalyticsTodayStrip
        sales={analytics.operations.todaySales}
        repairs={analytics.operations.todayOrders}
        billed={analytics.operations.todayRevenue}
      />

      <div className="analytics-executive-grid">
        <aside className="analytics-side-stack">
          <AnalyticsFunnelPanel funnel={analytics.funnel} />
          <AnalyticsPaymentsSplit metrics={analytics.metrics} />
          <AnalyticsOperationsPanel operations={analytics.operations} />
          <AnalyticsStockPanel stock={analytics.stock} />
          <AnalyticsSignalsPanel analytics={analytics} />
        </aside>

        <div className="analytics-charts-stack">
          <p className="hero-chart-note">
            {analyticsDateRange ? t('analytics.customRange.note') : t('analytics.comparisonNote')}
          </p>
          <AnalyticsChartPanel analytics={analytics} isLoading={isAnalyticsLoading} />
          <AnalyticsTopItemsPanel items={analytics.topLineItems} />
        </div>
      </div>
    </section>
  );
};
