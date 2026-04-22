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
  const conversionMetrics = [
    {
      label: 'Відвідувачі / дзвінки',
      value: analytics.currentSnapshot.salesCount
        ? `${Math.round((analytics.currentSnapshot.itemsSold / analytics.currentSnapshot.salesCount) * 100)}%`
        : '0%',
    },
    {
      label: 'Дзвінки / замовлення',
      value: analytics.currentSnapshot.salesCount
        ? `${Math.min(100, Math.round((analytics.currentSnapshot.salesCount / Math.max(productCount, 1)) * 100))}%`
        : '0%',
    },
    {
      label: 'Відвідувачі / замовлення',
      value: analytics.currentSnapshot.salesCount
        ? `${Math.min(100, Math.round((analytics.currentSnapshot.revenue / Math.max(totalFreeStock, 1)) * 100))}%`
        : '0%',
    },
  ];

  return (
    <section className="hero-card">
      <div className="hero-header">
        <h1>Основні бізнес-показники компанії</h1>
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

      <div className="hero-chart-card">
        <div className="hero-chart-layout">
          <div className="hero-conversion-column">
            <p className="section-label">Конверсія за вибраний період</p>
            <div className="hero-conversion-grid">
              {conversionMetrics.map((metric) => (
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
          </div>

          <div className="hero-chart-panel">
            <div className="hero-chart-header">
              <div>
                <p className="section-label">Порівняльний аналіз</p>
                <h2>{analytics.currentSnapshot.detailLabel}</h2>
              </div>
              <p className="hero-chart-note">
                Порівняння за {analytics.currentSnapshot.label}, {analytics.lastYearSnapshot.label}{' '}
                та {analytics.twoYearsAgoSnapshot.label}.
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
      </div>
    </section>
  );
};
