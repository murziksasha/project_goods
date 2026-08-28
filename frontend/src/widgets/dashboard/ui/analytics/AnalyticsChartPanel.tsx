import { useMemo, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildAreaPath,
  buildLinePath,
  buildStackedBarRects,
  formatCurrencyMetric,
  formatMetric,
  isSparseValues,
  type DashboardAnalyticsView,
} from '../../model/sales-analytics';

const chartWidth = 720;
const chartHeight = 260;
const chartPadding = { top: 18, right: 20, bottom: 32, left: 42 };
const PRODUCT_COLOR = '#2d8ae3';
const REPAIR_COLOR = '#14b8a6';

type ChartTab = 'billed' | 'mix' | 'volume';

type AnalyticsChartPanelProps = {
  analytics: DashboardAnalyticsView;
  isLoading: boolean;
};

const visibleSnapshots = (snapshots: DashboardAnalyticsView['revenueSnapshots']) =>
  snapshots.filter((snapshot, index) => index === 0 || snapshot.total > 0);

export const AnalyticsChartPanel = ({ analytics, isLoading }: AnalyticsChartPanelProps) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ChartTab>('billed');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const productValues = analytics.productRevenueSnapshots[0]?.values ?? [];
  const repairValues = analytics.repairRevenueSnapshots[0]?.values ?? [];
  const billedValues = analytics.revenueSnapshots[0]?.values ?? [];
  const comparison = visibleSnapshots(analytics.revenueSnapshots).slice(1);
  const sparse = isSparseValues(billedValues);
  const maxValue = Math.max(analytics.revenueChartMax, 1);

  const stackedBars = useMemo(
    () =>
      buildStackedBarRects(
        productValues,
        repairValues,
        maxValue,
        chartWidth,
        chartHeight,
        chartPadding,
      ),
    [productValues, repairValues, maxValue],
  );

  const handlePointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * chartWidth;
    const inner = chartWidth - chartPadding.left - chartPadding.right;
    const ratio = (x - chartPadding.left) / inner;
    const count = Math.max(billedValues.length, 1);
    const index = Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
    setHoverIndex(index);
  };

  const hoverLabel = hoverIndex != null ? analytics.axisLabels[hoverIndex] || String(hoverIndex + 1) : '';

  return (
    <section className="analytics-chart-panel">
      <div className="analytics-panel-header">
        <div>
          <p className="section-label">{t('analytics.comparativeAnalysis')}</p>
          <h2>{analytics.detailLabel}</h2>
        </div>
        <div className="analytics-chart-tabs" role="tablist">
          {(['billed', 'mix', 'volume'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? 'analytics-chart-tab analytics-chart-tab-active' : 'analytics-chart-tab'}
              onClick={() => setTab(item)}
            >
              {t(`analytics.chartTabs.${item}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-legend">
        <div className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ backgroundColor: PRODUCT_COLOR }} />
          <div>
            <strong>{t('analytics.mix.product')}</strong>
            <p>{formatCurrencyMetric(analytics.metrics.productRevenue)}</p>
          </div>
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ backgroundColor: REPAIR_COLOR }} />
          <div>
            <strong>{t('analytics.mix.repair')}</strong>
            <p>{formatCurrencyMetric(analytics.metrics.repairRevenue)}</p>
          </div>
        </div>
        {comparison.map((snapshot) => (
          <div key={snapshot.label} className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ backgroundColor: snapshot.color }} />
            <div>
              <strong>{snapshot.label}</strong>
              <p>{formatCurrencyMetric(snapshot.total)}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="empty-state">{t('analytics.skeleton')}</p>
      ) : tab === 'mix' ? (
        <MixChart
          product={analytics.metrics.productRevenue}
          repair={analytics.metrics.repairRevenue}
          productPct={analytics.metrics.mixProductPct}
          repairPct={analytics.metrics.mixRepairPct}
        />
      ) : !analytics.hasRevenueData && tab === 'billed' ? (
        <p className="empty-state">{t('analytics.noSalesForPeriod')}</p>
      ) : !analytics.hasOrdersData && tab === 'volume' && analytics.metrics.salesCount === 0 ? (
        <p className="empty-state">{t('analytics.noOrdersForPeriod')}</p>
      ) : (
        <div className="analytics-chart-frame">
          <svg
            className="hero-chart"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label={t(`analytics.chartTabs.${tab}`)}
            onPointerMove={handlePointer}
            onPointerLeave={() => setHoverIndex(null)}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
              const y =
                chartPadding.top +
                (chartHeight - chartPadding.top - chartPadding.bottom) * (1 - step);
              const value = Math.round((tab === 'volume' ? analytics.ordersChartMax : maxValue) * step);
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

            {tab === 'billed' && sparse
              ? stackedBars.map((bar) => (
                  <g key={bar.index}>
                    {bar.product.height > 0 ? (
                      <rect
                        x={bar.x}
                        y={bar.product.y}
                        width={bar.width}
                        height={bar.product.height}
                        rx="3"
                        fill={PRODUCT_COLOR}
                      />
                    ) : null}
                    {bar.repair.height > 0 ? (
                      <rect
                        x={bar.x}
                        y={bar.repair.y}
                        width={bar.width}
                        height={bar.repair.height}
                        rx="3"
                        fill={REPAIR_COLOR}
                      />
                    ) : null}
                  </g>
                ))
              : null}

            {tab === 'billed' && !sparse ? (
              <>
                <path
                  d={buildAreaPath(productValues, maxValue, chartWidth, chartHeight, chartPadding)}
                  fill={PRODUCT_COLOR}
                  fillOpacity="0.16"
                  stroke="none"
                />
                <path
                  d={buildLinePath(billedValues, maxValue, chartWidth, chartHeight, chartPadding)}
                  fill="none"
                  stroke={PRODUCT_COLOR}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d={buildLinePath(repairValues, maxValue, chartWidth, chartHeight, chartPadding)}
                  fill="none"
                  stroke={REPAIR_COLOR}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </>
            ) : null}

            {tab === 'volume' ? (
              <>
                <path
                  d={buildLinePath(
                    analytics.salesCountSnapshots[0]?.values ?? [],
                    analytics.ordersChartMax,
                    chartWidth,
                    chartHeight,
                    chartPadding,
                  )}
                  fill="none"
                  stroke={PRODUCT_COLOR}
                  strokeWidth="3"
                />
                <path
                  d={buildLinePath(
                    analytics.orderSnapshots[0]?.values ?? [],
                    analytics.ordersChartMax,
                    chartWidth,
                    chartHeight,
                    chartPadding,
                  )}
                  fill="none"
                  stroke={REPAIR_COLOR}
                  strokeWidth="3"
                />
              </>
            ) : null}

            {tab === 'billed'
              ? comparison.map((snapshot) => (
                  <path
                    key={snapshot.label}
                    d={buildLinePath(snapshot.values, maxValue, chartWidth, chartHeight, chartPadding)}
                    fill="none"
                    stroke={snapshot.color}
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                ))
              : null}

            {hoverIndex != null ? (
              <line
                x1={
                  chartPadding.left +
                  (billedValues.length <= 1
                    ? (chartWidth - chartPadding.left - chartPadding.right) / 2
                    : (hoverIndex / (billedValues.length - 1)) *
                      (chartWidth - chartPadding.left - chartPadding.right))
                }
                x2={
                  chartPadding.left +
                  (billedValues.length <= 1
                    ? (chartWidth - chartPadding.left - chartPadding.right) / 2
                    : (hoverIndex / (billedValues.length - 1)) *
                      (chartWidth - chartPadding.left - chartPadding.right))
                }
                y1={chartPadding.top}
                y2={chartHeight - chartPadding.bottom}
                className="hero-chart-gridline"
              />
            ) : null}
          </svg>

          {hoverIndex != null ? (
            <div className="analytics-chart-tooltip" role="status">
              <strong>{hoverLabel}</strong>
              {tab === 'billed' ? (
                <>
                  <span>
                    {t('analytics.mix.product')}: {formatCurrencyMetric(productValues[hoverIndex] ?? 0)}
                  </span>
                  <span>
                    {t('analytics.mix.repair')}: {formatCurrencyMetric(repairValues[hoverIndex] ?? 0)}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {t('analytics.summary.sales')}: {formatMetric(analytics.salesCountSnapshots[0]?.values[hoverIndex] ?? 0)}
                  </span>
                  <span>
                    {t('analytics.summary.repairOrders')}: {formatMetric(analytics.orderSnapshots[0]?.values[hoverIndex] ?? 0)}
                  </span>
                </>
              )}
            </div>
          ) : null}

          <div className="chart-axis-labels">
            {analytics.axisLabels.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const MixChart = ({
  product,
  repair,
  productPct,
  repairPct,
}: {
  product: number;
  repair: number;
  productPct: number;
  repairPct: number;
}) => {
  const { t } = useTranslation();
  const total = product + repair;
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const productLen = total > 0 ? (product / total) * circ : 0;

  return (
    <div className="analytics-mix-chart">
      <svg viewBox="0 0 160 160" className="analytics-mix-donut" role="img">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--color-line-panel)" strokeWidth="18" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={PRODUCT_COLOR}
          strokeWidth="18"
          strokeDasharray={`${productLen} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={REPAIR_COLOR}
          strokeWidth="18"
          strokeDasharray={`${Math.max(circ - productLen, 0)} ${circ}`}
          strokeDashoffset={-productLen}
          transform="rotate(-90 80 80)"
        />
      </svg>
      <div>
        <p>
          {t('analytics.mix.product')}: {formatMetric(productPct)}%
        </p>
        <p>
          {t('analytics.mix.repair')}: {formatMetric(repairPct)}%
        </p>
      </div>
    </div>
  );
};
