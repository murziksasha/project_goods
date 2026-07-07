import { useTranslation } from 'react-i18next';
import type { DashboardPreferences } from '../../../../entities/settings/model/types';
import type { Product } from '../../../../entities/product/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import {
  getAnalyticsDateRangeFilterCount,
  type AnalyticsDateRange,
} from '../../model/analytics-date-range';
import {
  buildDashboardAnalytics,
  buildLinePath,
  formatCurrencyMetric,
  formatMetric,
} from '../../model/sales-analytics';
import type { StatsPeriod } from '../../model/stats-period';
import { AnalyticsDateFilterPanel } from './AnalyticsDateFilterPanel';
import { StatsPeriodToggle } from './StatsPeriodToggle';
import { MarketWeatherWidget } from '../weather/MarketWeatherWidget';

type AnalyticsHeroSectionProps = {
  sales: Sale[];
  orders: Sale[];
  products: Product[];
  clientCount: number;
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

const chartWidth = 720;
const chartHeight = 260;
const chartPadding = { top: 18, right: 20, bottom: 32, left: 42 };

type ChartPanelProps = {
  title: string;
  valueLabel: string;
  emptyText: string;
  isLoading: boolean;
  hasData: boolean;
  snapshots: Array<{ label: string; values: number[]; total: number; color: string }>;
  maxValue: number;
  axisLabels: string[];
  formatTotal?: (value: number) => string;
};

const ChartPanel = ({
  title,
  valueLabel,
  emptyText,
  isLoading,
  hasData,
  snapshots,
  maxValue,
  axisLabels,
  formatTotal = formatMetric,
}: ChartPanelProps) => {
  const { t } = useTranslation();

  return (
    <section className="analytics-chart-panel">
      <div className="analytics-panel-header">
        <div>
          <p className="section-label">{valueLabel}</p>
          <h2>{title}</h2>
        </div>
        <div className="chart-legend">
          {snapshots.map((snapshot) => (
            <div key={snapshot.label} className="chart-legend-item">
              <span className="chart-legend-swatch" style={{ backgroundColor: snapshot.color }} />
              <div>
                <strong>{snapshot.label}</strong>
                <p>{formatTotal(snapshot.total)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="empty-state">{t('analytics.loadingAnalytics')}</p>
      ) : !hasData ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        <>
          <svg className="hero-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img">
            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
              const y =
                chartPadding.top +
                (chartHeight - chartPadding.top - chartPadding.bottom) * (1 - step);
              const value = Math.round(maxValue * step);

              return (
                <g key={step}>
                  <line
                    x1={chartPadding.left}
                    x2={chartWidth - chartPadding.right}
                    y1={y}
                    y2={y}
                    className="hero-chart-gridline"
                  />
                  <text x="8" y={y + 4} className="chart-y-label">
                    {formatMetric(value)}
                  </text>
                </g>
              );
            })}

            {snapshots.map((snapshot) => (
              <path
                key={snapshot.label}
                d={buildLinePath(
                  snapshot.values,
                  maxValue,
                  chartWidth,
                  chartHeight,
                  chartPadding,
                )}
                fill="none"
                stroke={snapshot.color}
                strokeWidth={snapshot.label === snapshots[0].label ? '4' : '2.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {snapshots.map((snapshot) =>
              snapshot.values.map((value, index) => {
                const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
                const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
                const x =
                  chartPadding.left +
                  (snapshot.values.length === 1
                    ? innerWidth / 2
                    : (index / (snapshot.values.length - 1)) * innerWidth);
                const y =
                  chartPadding.top +
                  innerHeight -
                  (value / Math.max(maxValue, 1)) * innerHeight;

                return value > 0 ? (
                  <circle
                    key={`${snapshot.label}-${index}`}
                    cx={x}
                    cy={y}
                    r={snapshot.label === snapshots[0].label ? '4' : '3'}
                    fill={snapshot.color}
                  />
                ) : null;
              }),
            )}
          </svg>

          <div className="chart-axis-labels">
            {axisLabels.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export const AnalyticsHeroSection = ({
  sales,
  orders,
  products,
  clientCount,
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
  const analytics = buildDashboardAnalytics(
    sales,
    orders,
    statsPeriod,
    products,
    new Date(),
    analyticsDateRange,
  );
  const dateFilterCount = getAnalyticsDateRangeFilterCount(analyticsDateRange);

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
            hasCustomDateRange={Boolean(analyticsDateRange?.dateFrom || analyticsDateRange?.dateTo)}
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

      <div className="analytics-summary-grid analytics-summary-grid-wide">
        {analytics.summaryCards.map((card) => (
          <article key={card.labelKey} className="analytics-summary-card">
            <span className="metric-label">{t(card.labelKey)}</span>
            <strong style={{ color: card.accent }}>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="analytics-executive-grid">
        <aside className="analytics-side-stack">
          <section className="analytics-info-panel">
            <div className="analytics-panel-header">
              <div>
                <p className="section-label">{t('analytics.workflow')}</p>
                <h2>{t('analytics.operationalPulse')}</h2>
              </div>
            </div>
            <div className="analytics-mini-grid">
              <div>
                <span className="metric-label">{t('analytics.open')}</span>
                <strong>{formatMetric(analytics.operations.openOrders)}</strong>
              </div>
              <div>
                <span className="metric-label">{t('analytics.closed')}</span>
                <strong>{formatMetric(analytics.operations.closedOrders)}</strong>
              </div>
              <div>
                <span className="metric-label">{t('analytics.todaySales')}</span>
                <strong>{formatMetric(analytics.operations.todaySales)}</strong>
              </div>
              <div>
                <span className="metric-label">{t('analytics.todayRepairs')}</span>
                <strong>{formatMetric(analytics.operations.todayOrders)}</strong>
              </div>
            </div>
          </section>

          <section className="analytics-info-panel">
            <div className="analytics-panel-header">
              <div>
                <p className="section-label">{t('analytics.stock')}</p>
                <h2>{t('analytics.inventoryHealth')}</h2>
              </div>
            </div>
            <div className="analytics-stock-list">
              <div>
                <span>{t('analytics.products')}</span>
                <strong>{formatMetric(analytics.stock.productCount)}</strong>
              </div>
              <div>
                <span>{t('analytics.freeStock')}</span>
                <strong>{formatMetric(analytics.stock.freeStock)}</strong>
              </div>
              <div>
                <span>{t('analytics.reserved')}</span>
                <strong>{formatMetric(analytics.stock.reservedStock)}</strong>
              </div>
              <div>
                <span>{t('analytics.stockValue')}</span>
                <strong>{formatCurrencyMetric(analytics.stock.stockValue)}</strong>
              </div>
              <div>
                <span>{t('analytics.clients')}</span>
                <strong>{formatMetric(clientCount)}</strong>
              </div>
            </div>
          </section>

          <section className="analytics-info-panel">
            <div className="analytics-panel-header">
              <div>
                <p className="section-label">{t('analytics.signals')}</p>
                <h2>{t('analytics.attentionQueue')}</h2>
              </div>
            </div>
            <div className="analytics-signal-list">
              {analytics.signals.map((signal) => (
                <div
                  key={signal.labelKey}
                  className={`analytics-signal analytics-signal-${signal.tone}`}
                >
                  <span>{t(signal.labelKey)}</span>
                  <strong>{signal.value}</strong>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="analytics-charts-stack">
          <div className="analytics-period-row">
            <div>
              <p className="section-label">{t('analytics.comparativeAnalysis')}</p>
              <h2>{analytics.detailLabel}</h2>
            </div>
            <p className="hero-chart-note">
              {analyticsDateRange
                ? t('analytics.customRange.note')
                : t('analytics.comparisonNote')}
            </p>
          </div>

          <ChartPanel
            title={t('analytics.revenue')}
            valueLabel={t('analytics.productSales')}
            emptyText={t('analytics.noSalesForPeriod')}
            isLoading={isSalesLoading}
            hasData={analytics.hasRevenueData}
            snapshots={analytics.revenueSnapshots}
            maxValue={analytics.revenueChartMax}
            axisLabels={analytics.axisLabels}
            formatTotal={formatCurrencyMetric}
          />

          <ChartPanel
            title={t('analytics.repairOrders')}
            valueLabel={t('analytics.orderVolume')}
            emptyText={t('analytics.noOrdersForPeriod')}
            isLoading={isSalesLoading}
            hasData={analytics.hasOrdersData}
            snapshots={analytics.orderSnapshots}
            maxValue={analytics.ordersChartMax}
            axisLabels={analytics.axisLabels}
          />
        </div>
      </div>
    </section>
  );
};