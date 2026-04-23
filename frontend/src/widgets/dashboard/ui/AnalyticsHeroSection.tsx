import type { Sale } from '../../../entities/sale/model/types';
import {
  buildDashboardAnalytics,
  buildLinePath,
  formatMetric,
  type StatsPeriod,
} from '../model/sales-analytics';

type AnalyticsHeroSectionProps = {
  sales: Sale[];
  orders: Sale[];
  productCount: number;
  clientCount: number;
  totalFreeStock: number;
  isSalesLoading: boolean;
  isSeeding: boolean;
  isExporting: boolean;
  hasProducts: boolean;
  statsPeriod: StatsPeriod;
  onStatsPeriodChange: (value: StatsPeriod) => void;
  onSeed: () => void;
  onExport: () => void;
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
}: ChartPanelProps) => (
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
              <p>{formatMetric(snapshot.total)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {isLoading ? (
      <p className="empty-state">Loading analytics...</p>
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

export const AnalyticsHeroSection = ({
  sales,
  orders,
  productCount,
  clientCount,
  totalFreeStock,
  isSalesLoading,
  isSeeding,
  isExporting,
  hasProducts,
  statsPeriod,
  onStatsPeriodChange,
  onSeed,
  onExport,
}: AnalyticsHeroSectionProps) => {
  const analytics = buildDashboardAnalytics(sales, orders, statsPeriod);

  return (
    <section className="hero-card analytics-dashboard">
      <div className="hero-header">
        <div>
          <h1>Основні бізнес-показники компанії</h1>
          <p className="hero-chart-note">
            Порівняння продажів і ремонтних замовлень за {analytics.comparisonLabel}.
          </p>
        </div>
        <div className="hero-controls">
          <div className="period-toggle" role="tablist" aria-label="Statistics period">
            {analytics.statsPeriodOptions.map((option) => (
              <button
                key={option.value}
                className={
                  option.value === statsPeriod
                    ? 'period-button period-button-active'
                    : 'period-button'
                }
                type="button"
                onClick={() => onStatsPeriodChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button className="secondary-button" type="button" onClick={onSeed} disabled={isSeeding}>
            {isSeeding ? 'Loading...' : 'Demo data'}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={onExport}
            disabled={isExporting || !hasProducts}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      <div className="analytics-summary-grid">
        {analytics.summaryCards.map((card) => (
          <article key={card.label} className="analytics-summary-card">
            <span className="metric-label">{card.label}</span>
            <strong style={{ color: card.accent }}>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="hero-chart-card">
        <div className="analytics-report-layout">
          <aside className="hero-conversion-column">
            <p className="section-label">Конверсія за вибраний період</p>
            <div className="hero-conversion-grid">
              {analytics.conversionCards.map((metric) => (
                <article key={metric.label} className="metric-card metric-card-hero">
                  <strong>{metric.value}</strong>
                  <p className="metric-hint">{metric.label}</p>
                </article>
              ))}
            </div>

            <div className="hero-inline-metrics">
              <div className="hero-inline-metric">
                <span className="metric-label">Товари</span>
                <strong>{formatMetric(productCount)}</strong>
              </div>
              <div className="hero-inline-metric">
                <span className="metric-label">Клієнти</span>
                <strong>{formatMetric(clientCount)}</strong>
              </div>
              <div className="hero-inline-metric">
                <span className="metric-label">Залишок</span>
                <strong>{formatMetric(totalFreeStock)}</strong>
              </div>
            </div>
          </aside>

          <div className="analytics-charts-stack">
            <div className="analytics-period-row">
              <div>
                <p className="section-label">Порівняльний аналіз</p>
                <h2>{analytics.detailLabel}</h2>
              </div>
              <p className="hero-chart-note">
                Поточний період завжди синій; попередні роки залишаються помаранчевим і зеленим.
              </p>
            </div>

            <ChartPanel
              title="Продажи"
              valueLabel="Выручка"
              emptyText="No sales found for the selected period."
              isLoading={isSalesLoading}
              hasData={analytics.hasRevenueData}
              snapshots={analytics.revenueSnapshots}
              maxValue={analytics.revenueChartMax}
              axisLabels={analytics.axisLabels}
            />

            <ChartPanel
              title="Заказы"
              valueLabel="Ремонтные заказы"
              emptyText="No repair orders found for the selected period."
              isLoading={isSalesLoading}
              hasData={analytics.hasOrdersData}
              snapshots={analytics.orderSnapshots}
              maxValue={analytics.ordersChartMax}
              axisLabels={analytics.axisLabels}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
