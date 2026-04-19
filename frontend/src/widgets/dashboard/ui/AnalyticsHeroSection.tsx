import type { Sale } from '../../../entities/sale/model/types';
import { buildLinePath, buildSalesAnalytics, formatCompactMetric, formatMetric, type StatsPeriod } from '../model/sales-analytics';

type AnalyticsHeroSectionProps = {
  sales: Sale[];
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

const chartWidth = 520;
const chartHeight = 260;
const chartPadding = { top: 18, right: 18, bottom: 34, left: 18 };

export const AnalyticsHeroSection = ({
  sales,
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
  const analytics = buildSalesAnalytics(sales, statsPeriod);

  return (
    <section className="hero-card">
      <div className="hero-copy">
        <p className="eyebrow">Sales analytics</p>
        <h1>Track sales by period and compare them with previous years.</h1>
        <p className="hero-text">
          Choose today, this month, or last month to see live totals and compare
          the same window against the previous two years.
        </p>

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

        <div className="hero-stat-grid">
          {analytics.heroStatCards.map((card) => (
            <article key={card.label} className="metric-card metric-card-hero">
              <span className="metric-label">{card.label}</span>
              <strong>{card.value}</strong>
              <p className="metric-hint">{card.hint}</p>
            </article>
          ))}
        </div>

        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={onSeed} disabled={isSeeding}>
            {isSeeding ? 'Seeding...' : 'Create demo data'}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={onExport}
            disabled={isExporting || !hasProducts}
          >
            {isExporting ? 'Exporting...' : 'Export products'}
          </button>
        </div>

        <div className="hero-inline-metrics">
          <div className="hero-inline-metric">
            <span className="metric-label">Products</span>
            <strong>{formatMetric(productCount)}</strong>
          </div>
          <div className="hero-inline-metric">
            <span className="metric-label">Clients</span>
            <strong>{formatMetric(clientCount)}</strong>
          </div>
          <div className="hero-inline-metric">
            <span className="metric-label">Free stock</span>
            <strong>{formatMetric(totalFreeStock)}</strong>
          </div>
        </div>
      </div>

      <div className="hero-chart-panel">
        <div className="hero-chart-card">
          <div className="hero-chart-header">
            <div>
              <p className="section-label">Comparison chart</p>
              <h2>{analytics.currentSnapshot.detailLabel}</h2>
            </div>
            <p className="hero-chart-note">
              Same {statsPeriod === 'today' ? 'day' : 'period'} in {analytics.currentSnapshot.label},{' '}
              {analytics.lastYearSnapshot.label}, and {analytics.twoYearsAgoSnapshot.label}.
            </p>
          </div>

          <div className="chart-legend">
            {analytics.snapshots.map((snapshot) => (
              <div key={snapshot.label} className="chart-legend-item">
                <span className="chart-legend-swatch" style={{ backgroundColor: snapshot.color }} />
                <div>
                  <strong>{snapshot.label}</strong>
                  <p>{formatCompactMetric(snapshot.revenue)} revenue</p>
                </div>
              </div>
            ))}
          </div>

          {isSalesLoading ? (
            <p className="empty-state">Loading sales statistics...</p>
          ) : !analytics.hasPeriodSales ? (
            <p className="empty-state">
              No sales found for the selected period in the current or previous years.
            </p>
          ) : statsPeriod === 'today' ? (
            <div className="bar-chart" aria-label="Sales comparison by year">
              {analytics.snapshots.map((snapshot) => (
                <div key={snapshot.label} className="bar-chart-item">
                  <div className="bar-chart-track">
                    <div
                      className="bar-chart-bar"
                      style={{
                        height: `${(snapshot.revenue / analytics.chartMaxValue) * 100}%`,
                        backgroundColor: snapshot.color,
                      }}
                    />
                  </div>
                  <strong>{snapshot.label}</strong>
                  <span>{formatCompactMetric(snapshot.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <svg
                className="hero-chart"
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                role="img"
                aria-label="Sales comparison chart"
              >
                {[0.25, 0.5, 0.75, 1].map((step) => {
                  const y =
                    chartPadding.top +
                    (chartHeight - chartPadding.top - chartPadding.bottom) * (1 - step);

                  return (
                    <line
                      key={step}
                      x1={chartPadding.left}
                      x2={chartWidth - chartPadding.right}
                      y1={y}
                      y2={y}
                      className="hero-chart-gridline"
                    />
                  );
                })}

                {analytics.snapshots.map((snapshot) => (
                  <path
                    key={snapshot.label}
                    d={buildLinePath(
                      snapshot.values,
                      analytics.chartMaxValue,
                      chartWidth,
                      chartHeight,
                      chartPadding,
                    )}
                    fill="none"
                    stroke={snapshot.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}

                {analytics.snapshots.map((snapshot) =>
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
                      (value / Math.max(analytics.chartMaxValue, 1)) * innerHeight;

                    return (
                      <circle
                        key={`${snapshot.label}-${index}`}
                        cx={x}
                        cy={y}
                        r="3.5"
                        fill={snapshot.color}
                      />
                    );
                  }),
                )}
              </svg>

              <div className="chart-axis-labels">
                {analytics.periodLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
