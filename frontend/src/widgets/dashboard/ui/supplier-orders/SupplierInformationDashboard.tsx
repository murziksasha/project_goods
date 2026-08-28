import { useMemo, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../../shared/lib/format';
import { formatDeltaPct } from '../../model/analytics-aggregates';
import {
  buildAreaPath,
  buildLinePath,
} from '../../model/sales-analytics';
import type {
  SupplierOrderAnalytics,
  SupplierOrderProductStat,
  SupplierOrderSupplierStat,
} from '../../model/supplier-order-utils';
import { formatPercent } from '../../model/supplier-orders-workspace';
import { AnalyticsSparkline } from '../analytics/AnalyticsSparkline';

type SupplierInformationDashboardProps = {
  filteredOrdersCount: number;
  isLoading: boolean;
  supplierInformation: SupplierOrderAnalytics;
};

const STATUS_COLORS: Record<string, string> = {
  request: '#94a3b8',
  ordered: '#38bdf8',
  approved: '#818cf8',
  partially_stocked: '#f59e0b',
  partially_completed: '#14b8a6',
  stocked: '#10b981',
  overdue: '#dc3545',
  cancelled: '#64748b',
  unavailable: '#475569',
};

const PAYMENT_COLORS: Record<string, string> = {
  paid: '#10b981',
  pending: '#f59e0b',
  without_payment: '#2d8ae3',
  cancelled: '#64748b',
};

const chartWidth = 640;
const chartHeight = 220;
const chartPadding = { top: 16, right: 16, bottom: 28, left: 44 };

const DeltaChip = ({ value }: { value: number | null | undefined }) => {
  const formatted = formatDeltaPct(value ?? null);
  if (!formatted) return null;
  const tone = (value ?? 0) > 0 ? 'up' : (value ?? 0) < 0 ? 'down' : 'flat';
  return (
    <span className={`analytics-delta analytics-delta-${tone}`}>{formatted}</span>
  );
};

const MetricCard = ({
  label,
  value,
  hint,
  tone,
  delta,
  sparkline,
  coverage,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'risk';
  delta?: number | null;
  sparkline?: number[];
  coverage?: number;
}) => (
  <article className="supplier-information-card supplier-information-kpi">
    <div className="supplier-information-kpi-top">
      <span>{label}</span>
      <DeltaChip value={delta} />
    </div>
    <strong className={tone ? `supplier-information-kpi-${tone}` : undefined}>
      {value}
    </strong>
    {coverage != null ? (
      <div className="analytics-coverage" aria-hidden>
        <span style={{ width: `${Math.max(0, Math.min(100, coverage))}%` }} />
      </div>
    ) : null}
    {hint ? <small>{hint}</small> : null}
    {sparkline && sparkline.length > 0 ? (
      <AnalyticsSparkline values={sparkline} />
    ) : null}
  </article>
);

const RankedBars = ({
  items,
  getKey,
  getLabel,
  getValue,
  formatValue,
  getHint,
}: {
  items: Array<SupplierOrderProductStat | SupplierOrderSupplierStat>;
  getKey: (item: SupplierOrderProductStat | SupplierOrderSupplierStat) => string;
  getLabel: (item: SupplierOrderProductStat | SupplierOrderSupplierStat) => string;
  getValue: (item: SupplierOrderProductStat | SupplierOrderSupplierStat) => number;
  formatValue: (item: SupplierOrderProductStat | SupplierOrderSupplierStat) => string;
  getHint: (item: SupplierOrderProductStat | SupplierOrderSupplierStat) => string;
}) => {
  const max = Math.max(1, ...items.map(getValue));
  return (
    <div className="supplier-information-rank">
      {items.map((item) => (
        <div key={getKey(item)} className="supplier-information-rank-item">
          <div className="supplier-information-rank-row">
            <span>{getLabel(item)}</span>
            <strong>{formatValue(item)}</strong>
          </div>
          <div className="supplier-information-rank-track" aria-hidden>
            <span style={{ width: `${(getValue(item) / max) * 100}%` }} />
          </div>
          <small>{getHint(item)}</small>
        </div>
      ))}
    </div>
  );
};

const SpendChart = ({ analytics }: { analytics: SupplierOrderAnalytics }) => {
  const { t } = useTranslation();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const values = analytics.spendSeries.map((point) => point.value);
  const maxValue = Math.max(1, ...values);
  const line = useMemo(
    () => buildLinePath(values, maxValue, chartWidth, chartHeight, chartPadding),
    [maxValue, values],
  );
  const area = useMemo(
    () => buildAreaPath(values, maxValue, chartWidth, chartHeight, chartPadding),
    [maxValue, values],
  );

  const handlePointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * chartWidth;
    const inner = chartWidth - chartPadding.left - chartPadding.right;
    const ratio = (x - chartPadding.left) / inner;
    const count = Math.max(values.length, 1);
    const index = Math.min(
      count - 1,
      Math.max(0, Math.round(ratio * (count - 1))),
    );
    setHoverIndex(index);
  };

  const hover = hoverIndex != null ? analytics.spendSeries[hoverIndex] : null;

  return (
    <section className="supplier-information-panel">
      <div className="supplier-information-panel-header">
        <div>
          <p className="section-label">{t('orders.supplier.information.spendTrendHint')}</p>
          <h2>{t('orders.supplier.information.spendTrend')}</h2>
        </div>
      </div>
      {analytics.spendSeries.length === 0 ? (
        <p className="orders-empty">{t('orders.supplier.information.empty')}</p>
      ) : (
        <div className="analytics-chart-frame">
          {hover ? (
            <div className="analytics-chart-tooltip">
              <strong>{hover.label}</strong>
              <span>{formatCurrency(hover.value)}</span>
              <span>
                {t('orders.supplier.information.chartOrders', {
                  count: hover.orderCount,
                })}
              </span>
            </div>
          ) : null}
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="supplier-information-spend-svg"
            onPointerMove={handlePointer}
            onPointerLeave={() => setHoverIndex(null)}
            role="img"
            aria-label={t('orders.supplier.information.spendTrend')}
          >
            <path d={area} fill="rgba(45, 138, 227, 0.16)" />
            <path
              d={line}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {analytics.spendSeries.map((point, index) => {
              const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
              const x =
                analytics.spendSeries.length === 1
                  ? chartPadding.left + innerWidth / 2
                  : chartPadding.left +
                    (index / (analytics.spendSeries.length - 1)) * innerWidth;
              const show =
                index === 0 ||
                index === analytics.spendSeries.length - 1 ||
                index % Math.ceil(analytics.spendSeries.length / 6) === 0;
              return show ? (
                <text
                  key={point.key}
                  x={x}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className="supplier-information-chart-label"
                >
                  {point.label}
                </text>
              ) : null;
            })}
          </svg>
        </div>
      )}
    </section>
  );
};

export const SupplierInformationDashboard = ({
  filteredOrdersCount,
  isLoading,
  supplierInformation,
}: SupplierInformationDashboardProps) => {
  const { t } = useTranslation();
  const [goodsTab, setGoodsTab] = useState<'quantity' | 'value' | 'frequency'>(
    'quantity',
  );
  const [supplierTab, setSupplierTab] = useState<'spend' | 'outstanding'>(
    'spend',
  );
  const coverage = supplierInformation.paymentCoveragePercent;
  const spendValues = supplierInformation.spendSeries.map((point) => point.value);
  const statusTotal = supplierInformation.statusBreakdown.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const paymentTotal = supplierInformation.paymentBreakdown.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const goodsItems =
    goodsTab === 'value'
      ? supplierInformation.topProductsByValue
      : goodsTab === 'frequency'
        ? supplierInformation.topProductsByFrequency
        : supplierInformation.topProductsByQuantity;
  const supplierItems =
    supplierTab === 'outstanding'
      ? supplierInformation.topSuppliersByPending
      : supplierInformation.topSuppliersBySpend;
  const vsLabel = t('orders.supplier.information.vsPrevious');

  if (isLoading) {
    return (
      <section className="supplier-information-dashboard">
        <p className="orders-empty">{t('orders.supplier.information.loading')}</p>
      </section>
    );
  }

  if (filteredOrdersCount === 0) {
    return (
      <section className="supplier-information-dashboard">
        <p className="orders-empty">{t('orders.supplier.information.empty')}</p>
      </section>
    );
  }

  return (
    <section className="supplier-information-dashboard">
      <div className="supplier-information-summary">
        <MetricCard
          label={t('orders.supplier.information.totalValue')}
          value={formatCurrency(supplierInformation.totalValue)}
          hint={
            supplierInformation.previousWindow
              ? vsLabel
              : t('orders.supplier.information.filteredSpend')
          }
          delta={supplierInformation.previousWindow?.deltas.totalValuePct}
          sparkline={spendValues}
        />
        <MetricCard
          label={t('orders.supplier.information.paid')}
          value={formatCurrency(supplierInformation.paidAmount)}
          hint={t('orders.supplier.information.covered', {
            percent: formatPercent(coverage),
          })}
          tone="good"
          delta={supplierInformation.previousWindow?.deltas.paidAmountPct}
          coverage={coverage}
        />
        <MetricCard
          label={t('orders.supplier.information.outstanding')}
          value={formatCurrency(supplierInformation.outstandingAmount)}
          hint={
            supplierInformation.overdueOutstanding > 0
              ? `${t('orders.supplier.information.overdueOutstanding')}: ${formatCurrency(supplierInformation.overdueOutstanding)}`
              : t('orders.supplier.information.pendingPayment')
          }
          tone={supplierInformation.overdueOutstanding > 0 ? 'risk' : undefined}
        />
        <MetricCard
          label={t('orders.supplier.information.openPipeline')}
          value={formatCurrency(supplierInformation.openPipelineValue)}
          hint={t('orders.supplier.information.openPipelineHint', {
            count: supplierInformation.openPipelineCount,
          })}
        />
      </div>

      <div className="supplier-information-summary supplier-information-summary-compact">
        <MetricCard
          label={t('orders.supplier.information.ordersAndPcs')}
          value={String(supplierInformation.orderCount)}
          hint={t('orders.supplier.information.pcsOrdered', {
            count: supplierInformation.totalQuantity,
          })}
          delta={supplierInformation.previousWindow?.deltas.orderCountPct}
        />
        <MetricCard
          label={t('orders.supplier.information.stockedRate')}
          value={formatPercent(supplierInformation.stockedRate)}
          hint={t('orders.supplier.information.stockedHint')}
        />
      </div>

      <div className="supplier-information-charts">
        <SpendChart analytics={supplierInformation} />
        <section className="supplier-information-panel">
          <h2>{t('orders.supplier.information.statusMix')}</h2>
          <div
            className="analytics-funnel-bar"
            aria-label={t('orders.supplier.information.statusMix')}
          >
            {supplierInformation.statusBreakdown.map((item) =>
              item.count > 0 ? (
                <span
                  key={item.status}
                  style={{
                    width: `${statusTotal > 0 ? (item.count / statusTotal) * 100 : 0}%`,
                    backgroundColor: STATUS_COLORS[item.status] ?? '#64748b',
                  }}
                  title={`${item.status}: ${item.count}`}
                />
              ) : null,
            )}
          </div>
          <div className="analytics-funnel-legend">
            {supplierInformation.statusBreakdown
              .filter((item) => item.count > 0)
              .map((item) => (
                <div key={item.status}>
                  <span
                    className="chart-legend-swatch"
                    style={{
                      backgroundColor: STATUS_COLORS[item.status] ?? '#64748b',
                    }}
                  />
                  <span>
                    {t(`orders.supplier.orderStatuses.${item.status}`)}
                  </span>
                  <strong>{item.count}</strong>
                </div>
              ))}
          </div>
        </section>
        <section className="supplier-information-panel">
          <h2>{t('orders.supplier.information.paymentMix')}</h2>
          <div
            className="analytics-payments-bar"
            aria-label={t('orders.supplier.information.paymentMix')}
          >
            {supplierInformation.paymentBreakdown.map((item) =>
              item.amount > 0 ? (
                <span
                  key={item.status}
                  style={{
                    width: `${paymentTotal > 0 ? (item.amount / paymentTotal) * 100 : 0}%`,
                    backgroundColor: PAYMENT_COLORS[item.status] ?? '#64748b',
                  }}
                />
              ) : null,
            )}
          </div>
          <div className="analytics-funnel-legend">
            {supplierInformation.paymentBreakdown
              .filter((item) => item.count > 0)
              .map((item) => (
                <div key={item.status}>
                  <span
                    className="chart-legend-swatch"
                    style={{
                      backgroundColor: PAYMENT_COLORS[item.status] ?? '#64748b',
                    }}
                  />
                  <span>
                    {t(`orders.supplier.paymentStatuses.${item.status}`)}
                  </span>
                  <strong>{formatCurrency(item.amount)}</strong>
                </div>
              ))}
          </div>
        </section>
      </div>

      <div className="supplier-information-grid">
        <section className="supplier-information-panel">
          <div className="supplier-information-panel-header">
            <h2>{t('orders.supplier.information.topGoods')}</h2>
            <div className="analytics-chart-tabs" role="tablist">
              {(['quantity', 'value', 'frequency'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={goodsTab === tab}
                  className={
                    goodsTab === tab
                      ? 'analytics-chart-tab analytics-chart-tab-active'
                      : 'analytics-chart-tab'
                  }
                  onClick={() => setGoodsTab(tab)}
                >
                  {tab === 'quantity'
                    ? t('orders.supplier.information.tabQuantity')
                    : tab === 'value'
                      ? t('orders.supplier.information.tabValue')
                      : t('orders.supplier.information.tabFrequency')}
                </button>
              ))}
            </div>
          </div>
          {goodsItems.length > 0 ? (
            <RankedBars
              items={goodsItems}
              getKey={(item) => `goods-${(item as SupplierOrderProductStat).productName}`}
              getLabel={(item) => (item as SupplierOrderProductStat).productName}
              getValue={(item) =>
                goodsTab === 'value'
                  ? (item as SupplierOrderProductStat).total
                  : goodsTab === 'frequency'
                    ? (item as SupplierOrderProductStat).orderCount
                    : (item as SupplierOrderProductStat).quantity
              }
              formatValue={(item) =>
                goodsTab === 'value'
                  ? formatCurrency((item as SupplierOrderProductStat).total)
                  : goodsTab === 'frequency'
                    ? t('orders.supplier.information.orderCount', {
                        count: (item as SupplierOrderProductStat).orderCount,
                      })
                    : t('orders.supplier.information.quantityPcs', {
                        count: (item as SupplierOrderProductStat).quantity,
                      })
              }
              getHint={(item) =>
                `${t('orders.supplier.information.quantityPcs', {
                  count: (item as SupplierOrderProductStat).quantity,
                })} | ${t('orders.supplier.information.valueLabel')}: ${formatCurrency((item as SupplierOrderProductStat).total)}`
              }
            />
          ) : (
            <p className="orders-empty">
              {t('orders.supplier.information.noProductData')}
            </p>
          )}
        </section>

        <section className="supplier-information-panel">
          <div className="supplier-information-panel-header">
            <h2>{t('orders.supplier.information.topSuppliers')}</h2>
            <div className="analytics-chart-tabs" role="tablist">
              {(['spend', 'outstanding'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={supplierTab === tab}
                  className={
                    supplierTab === tab
                      ? 'analytics-chart-tab analytics-chart-tab-active'
                      : 'analytics-chart-tab'
                  }
                  onClick={() => setSupplierTab(tab)}
                >
                  {tab === 'spend'
                    ? t('orders.supplier.information.tabSpend')
                    : t('orders.supplier.information.tabOutstanding')}
                </button>
              ))}
            </div>
          </div>
          {supplierItems.length > 0 ? (
            <RankedBars
              items={supplierItems}
              getKey={(item) =>
                `sup-${(item as SupplierOrderSupplierStat).supplierId}-${(item as SupplierOrderSupplierStat).supplierName}`
              }
              getLabel={(item) => (item as SupplierOrderSupplierStat).supplierName}
              getValue={(item) =>
                supplierTab === 'outstanding'
                  ? (item as SupplierOrderSupplierStat).outstanding
                  : (item as SupplierOrderSupplierStat).total
              }
              formatValue={(item) =>
                formatCurrency(
                  supplierTab === 'outstanding'
                    ? (item as SupplierOrderSupplierStat).outstanding
                    : (item as SupplierOrderSupplierStat).total,
                )
              }
              getHint={(item) =>
                t('orders.supplier.information.ordersPaid', {
                  count: (item as SupplierOrderSupplierStat).orderCount,
                  amount: formatCurrency((item as SupplierOrderSupplierStat).paid),
                })
              }
            />
          ) : (
            <p className="orders-empty">
              {t('orders.supplier.information.noSupplierData')}
            </p>
          )}
        </section>

        <section className="supplier-information-panel">
          <h2>{t('orders.supplier.information.priceAnalysis')}</h2>
          <div className="supplier-information-price-grid">
            <div>
              <span>{t('orders.supplier.information.lowestPrice')}</span>
              <strong>
                {supplierInformation.lowestPricePosition
                  ? formatCurrency(supplierInformation.lowestPricePosition.price)
                  : '-'}
              </strong>
              <small>
                {supplierInformation.lowestPricePosition
                  ? `${supplierInformation.lowestPricePosition.productName} | ${supplierInformation.lowestPricePosition.orderNumber}`
                  : t('orders.supplier.information.noProductPositions')}
              </small>
            </div>
            <div>
              <span>{t('orders.supplier.information.highestPrice')}</span>
              <strong>
                {supplierInformation.highestPricePosition
                  ? formatCurrency(supplierInformation.highestPricePosition.price)
                  : '-'}
              </strong>
              <small>
                {supplierInformation.highestPricePosition
                  ? `${supplierInformation.highestPricePosition.productName} | ${supplierInformation.highestPricePosition.orderNumber}`
                  : t('orders.supplier.information.noProductPositions')}
              </small>
            </div>
          </div>
          {supplierInformation.productPriceRanges.length > 0 ? (
            <div className="supplier-information-rank">
              {supplierInformation.productPriceRanges.map((item) => {
                const max = Math.max(item.maxPrice, 1);
                const left = (item.minPrice / max) * 100;
                const width = ((item.maxPrice - item.minPrice) / max) * 100;
                const avg = (item.averagePrice / max) * 100;
                return (
                  <div
                    key={`range-${item.productName}`}
                    className="supplier-information-rank-item"
                  >
                    <div className="supplier-information-rank-row">
                      <span>{item.productName}</span>
                      <strong>
                        {t('orders.supplier.information.priceRange', {
                          min: formatCurrency(item.minPrice),
                          max: formatCurrency(item.maxPrice),
                        })}
                      </strong>
                    </div>
                    <div className="supplier-information-spread-track" aria-hidden>
                      <span
                        className="supplier-information-spread-range"
                        style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                      />
                      <span
                        className="supplier-information-spread-avg"
                        style={{ left: `${avg}%` }}
                      />
                    </div>
                    <small>
                      {t('orders.supplier.information.avgLines', {
                        amount: formatCurrency(item.averagePrice),
                        count: item.lineCount,
                      })}
                    </small>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="orders-empty">
              {t('orders.supplier.information.noRepeatedRanges')}
            </p>
          )}
        </section>

        <section className="supplier-information-panel supplier-information-signals">
          <h2>{t('orders.supplier.information.businessSignals')}</h2>
          <div className="supplier-information-signal-list">
            <div className="supplier-information-signal-danger">
              <span>{t('orders.supplier.information.overdueOrders')}</span>
              <strong>{supplierInformation.overdueCount}</strong>
              <small>
                {formatCurrency(supplierInformation.overdueOutstanding)}
              </small>
            </div>
            <div className="supplier-information-signal-warning">
              <span>{t('orders.supplier.information.lateRiskIn3Days')}</span>
              <strong>{supplierInformation.lateRiskCount}</strong>
            </div>
            <div>
              <span>{t('orders.supplier.information.cancelledUnavailable')}</span>
              <strong>
                {formatPercent(supplierInformation.cancelledUnavailableRate)}
              </strong>
            </div>
            <div>
              <span>{t('orders.supplier.information.avgLeadTime')}</span>
              <strong>
                {supplierInformation.averageLeadDays != null
                  ? t('orders.supplier.information.leadTimeDays', {
                      count: supplierInformation.averageLeadDays,
                    })
                  : '—'}
              </strong>
              <small>
                {supplierInformation.averageLeadDays != null
                  ? t('orders.supplier.information.leadTimeHint')
                  : t('orders.supplier.information.leadTimeEmpty')}
              </small>
            </div>
            <div
              className={
                supplierInformation.supplierConcentrationPercent >= 50
                  ? 'supplier-information-signal-warning'
                  : undefined
              }
            >
              <span>{t('orders.supplier.information.supplierConcentration')}</span>
              <strong>
                {formatPercent(supplierInformation.supplierConcentrationPercent)}
              </strong>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};
