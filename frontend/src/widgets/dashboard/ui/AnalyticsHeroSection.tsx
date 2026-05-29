import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  buildDashboardAnalytics,
  buildLinePath,
  formatCurrencyMetric,
  formatMetric,
  type StatsPeriod,
} from '../model/sales-analytics';

type AnalyticsHeroSectionProps = {
  sales: Sale[];
  orders: Sale[];
  products: Product[];
  clientCount: number;
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
              <p>{formatTotal(snapshot.total)}</p>
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
  products,
  clientCount,
  isSalesLoading,
  isSeeding,
  isExporting,
  hasProducts,
  statsPeriod,
  onStatsPeriodChange,
  onSeed,
  onExport,
}: AnalyticsHeroSectionProps) => {
  const analytics = buildDashboardAnalytics(sales, orders, statsPeriod, products);

  return (
    <section className="analytics-dashboard">
      <div className="analytics-executive-header">
        <div>
          <p className="section-label">Executive dashboard</p>
          <h1>Business performance</h1>
          <p className="hero-chart-note">
            Sales, repair workload, payments and stock health for {analytics.detailLabel}.
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
            {isSeeding ? 'Loading...' : 'Erase all data'}
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

      <div className="analytics-summary-grid analytics-summary-grid-wide">
        {analytics.summaryCards.map((card) => (
          <article key={card.label} className="analytics-summary-card">
            <span className="metric-label">{card.label}</span>
            <strong style={{ color: card.accent }}>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="analytics-executive-grid">
        <aside className="analytics-side-stack">
          <section className="analytics-info-panel">
            <div className="analytics-panel-header">
              <div>
                <p className="section-label">Workflow</p>
                <h2>Operational pulse</h2>
              </div>
            </div>
            <div className="analytics-mini-grid">
              <div>
                <span className="metric-label">Open</span>
                <strong>{formatMetric(analytics.operations.openOrders)}</strong>
              </div>
              <div>
                <span className="metric-label">Closed</span>
                <strong>{formatMetric(analytics.operations.closedOrders)}</strong>
              </div>
              <div>
                <span className="metric-label">Today sales</span>
                <strong>{formatMetric(analytics.operations.todaySales)}</strong>
              </div>
              <div>
                <span className="metric-label">Today repairs</span>
                <strong>{formatMetric(analytics.operations.todayOrders)}</strong>
              </div>
            </div>
          </section>

          <section className="analytics-info-panel">
            <div className="analytics-panel-header">
              <div>
                <p className="section-label">Stock</p>
                <h2>Inventory health</h2>
              </div>
            </div>
            <div className="analytics-stock-list">
              <div>
                <span>Products</span>
                <strong>{formatMetric(analytics.stock.productCount)}</strong>
              </div>
              <div>
                <span>Free stock</span>
                <strong>{formatMetric(analytics.stock.freeStock)}</strong>
              </div>
              <div>
                <span>Reserved</span>
                <strong>{formatMetric(analytics.stock.reservedStock)}</strong>
              </div>
              <div>
                <span>Stock value</span>
                <strong>{formatCurrencyMetric(analytics.stock.stockValue)}</strong>
              </div>
              <div>
                <span>Clients</span>
                <strong>{formatMetric(clientCount)}</strong>
              </div>
            </div>
          </section>

          <section className="analytics-info-panel">
            <div className="analytics-panel-header">
              <div>
                <p className="section-label">Signals</p>
                <h2>Attention queue</h2>
              </div>
            </div>
            <div className="analytics-signal-list">
              {analytics.signals.map((signal) => (
                <div key={signal.label} className={`analytics-signal analytics-signal-${signal.tone}`}>
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="analytics-charts-stack">
          <div className="analytics-period-row">
            <div>
              <p className="section-label">Comparative analysis</p>
              <h2>{analytics.detailLabel}</h2>
            </div>
            <p className="hero-chart-note">
              Current period is blue; previous comparable years are orange and green.
            </p>
          </div>

          <ChartPanel
            title="Revenue"
            valueLabel="Product sales"
            emptyText="No sales found for the selected period."
            isLoading={isSalesLoading}
            hasData={analytics.hasRevenueData}
            snapshots={analytics.revenueSnapshots}
            maxValue={analytics.revenueChartMax}
            axisLabels={analytics.axisLabels}
            formatTotal={formatCurrencyMetric}
          />

          <ChartPanel
            title="Repair orders"
            valueLabel="Order volume"
            emptyText="No repair orders found for the selected period."
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
