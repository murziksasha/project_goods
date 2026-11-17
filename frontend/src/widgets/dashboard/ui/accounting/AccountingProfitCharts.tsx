import type React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFinanceCategoriesQuery } from '../../../../entities/finance';
import type {
  ProfitCashCategoryRow,
  ProfitMarginRow,
} from '../../../../entities/finance';
import {
  foldUnknownOpexCategories,
  getFinanceCategoryLabel,
} from '../../../../entities/finance';
import { TruncatedTextTooltip } from '../../../../shared/ui/TruncatedTextTooltip';
import { AnalyticsSectionCard } from '../common/AnalyticsPrimitives';
import { formatMoney, formatPercent } from '../../model/accounting';
import {
  buildProfitChartRows,
  buildProfitMixShare,
  profitReportCogsColor,
  profitReportChartBarColors,
  profitReportChartMetricOptions,
  profitReportLeadersLimit,
  profitReportLeadersMetricOptions,
  profitReportProductColor,
  profitReportServiceColor,
  summarizeProfitMixUncostedRevenue,
  type ProfitReportChartMetric,
  type ProfitReportLeadersMetric,
} from '../../model/profit-report';

const mixRadius = 52;
const mixCirc = 2 * Math.PI * mixRadius;

export interface AccountingProfitChartsProps {
  rows: ProfitMarginRow[];
  chartMetric: ProfitReportChartMetric;
  onChartMetricChange?: (metric: ProfitReportChartMetric) => void;
  currency: string;
  cash: {
    collected: number;
    inventoryPurchases: number;
    opex: number;
    refunds: number;
    net: number;
  };
  isSectionCollapsed?: (sectionId: string) => boolean;
  onToggleSectionCollapse?: (sectionId: string) => void;
  onSetSectionCollapsed?: (sectionId: string, collapsed: boolean) => void;
}

const formatChartValue = (
  value: number,
  metric: ProfitReportChartMetric,
  currency: string,
) =>
  metric === 'quantity'
    ? String(value)
    : formatMoney(value, currency);

export const AccountingProfitCharts: React.FC<
  AccountingProfitChartsProps
> = ({
  rows,
  chartMetric,
  onChartMetricChange,
  currency,
  cash,
  isSectionCollapsed,
  onToggleSectionCollapse,
  onSetSectionCollapsed,
}) => {
  const { t } = useTranslation();
  const [leadersMetric, setLeadersMetric] =
    useState<ProfitReportLeadersMetric>('profit');
  const mix = buildProfitMixShare(rows, chartMetric);
  const uncosted = summarizeProfitMixUncostedRevenue(rows);
  const distributionRows = buildProfitChartRows(
    rows,
    leadersMetric,
    profitReportLeadersLimit,
  );
  const topBarRows = distributionRows.slice(0, 3);
  const formatLeadersValue = (value: number) =>
    leadersMetric === 'quantity'
      ? t('accounting.profit.charts.quantityValue', { count: value })
      : formatMoney(value, currency);
  const maxBarValue = Math.max(
    ...topBarRows.map((row) => Math.abs(row.value)),
    1,
  );
  const mixTotal = Math.abs(mix.product) + Math.abs(mix.service);
  const productLen =
    mixTotal > 0 ? (Math.abs(mix.product) / mixTotal) * mixCirc : 0;
  const outflowTotal =
    cash.collected +
    cash.inventoryPurchases +
    cash.opex +
    cash.refunds;
  const share = (value: number) =>
    outflowTotal > 0 ? (value / outflowTotal) * 100 : 0;

  return (
    <div className='finance-profit-charts'>
      <AnalyticsSectionCard
        id="accounting-reports-products-services"
        variant="finance"
        className="finance-profit-mix-panel"
        eyebrow={t('accounting.profit.charts.mixSection')}
        title={t('accounting.profit.charts.mixTitle')}
        actions={
          onChartMetricChange ? (
            <div
              className='period-toggle'
              role='tablist'
              aria-label={t('accounting.profit.charts.mixMetricAria')}
            >
              {profitReportChartMetricOptions.map((option) => (
                <button
                  key={option.value}
                  type='button'
                  aria-pressed={option.value === chartMetric}
                  className={
                    option.value === chartMetric
                      ? 'period-button period-button-active'
                      : 'period-button'
                  }
                  onClick={() => onChartMetricChange(option.value)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          ) : (
            <span className='report-badge is-info'>
              {t(`accounting.profit.visual.metrics.${chartMetric}`)}
            </span>
          )
        }
        collapsible={Boolean(isSectionCollapsed)}
        isCollapsed={
          isSectionCollapsed
            ? isSectionCollapsed('accounting-reports-products-services')
            : false
        }
        onCollapsedChange={(collapsed) => {
          if (onSetSectionCollapsed) {
            onSetSectionCollapsed(
              'accounting-reports-products-services',
              collapsed,
            );
          } else if (onToggleSectionCollapse) {
            onToggleSectionCollapse('accounting-reports-products-services');
          }
        }}
      >
        {mixTotal <= 0 ? (
          chartMetric === 'profit' && uncosted.total > 0 ? (
            <div className='finance-mix-empty-state'>
              <p className='empty-state'>
                {t('accounting.profit.charts.mixEmptyKnownProfit', {
                  amount: formatMoney(uncosted.total, currency),
                })}
              </p>
              {onChartMetricChange ? (
                <button
                  type='button'
                  className='secondary-button'
                  onClick={() => onChartMetricChange('revenue')}
                >
                  {t('accounting.profit.charts.switchToRevenue')}
                </button>
              ) : null}
            </div>
          ) : (
            <p className='empty-state'>
              {t('accounting.profit.charts.empty')}
            </p>
          )
        ) : (
          <div className='analytics-mix-chart'>
            <svg
              viewBox='0 0 160 160'
              className='analytics-mix-donut'
              role='img'
            >
              <circle
                cx='80'
                cy='80'
                r={mixRadius}
                fill='none'
                stroke='var(--color-line-panel)'
                strokeWidth='18'
              />
              <circle
                cx='80'
                cy='80'
                r={mixRadius}
                fill='none'
                stroke={profitReportProductColor}
                strokeWidth='18'
                strokeDasharray={`${productLen} ${mixCirc}`}
                strokeLinecap='round'
                transform='rotate(-90 80 80)'
              />
              <circle
                cx='80'
                cy='80'
                r={mixRadius}
                fill='none'
                stroke={profitReportServiceColor}
                strokeWidth='18'
                strokeDasharray={`${Math.max(mixCirc - productLen, 0)} ${mixCirc}`}
                strokeDashoffset={-productLen}
                transform='rotate(-90 80 80)'
              />
            </svg>
            <div className='analytics-mix-legend'>
              <div className='analytics-mix-legend-item'>
                <p>
                  <span
                    className='report-trend-dot'
                    style={{ backgroundColor: profitReportProductColor }}
                    aria-hidden='true'
                  />{' '}
                  {t('accounting.profit.types.product')}:{' '}
                  {formatPercent(mix.productPct)}
                  {' · '}
                  {formatChartValue(mix.product, chartMetric, currency)}
                </p>
                {chartMetric === 'profit' && uncosted.product > 0 ? (
                  <small className='muted-copy finance-mix-uncosted-note'>
                    {t('accounting.profit.charts.mixMissingCostLine', {
                      amount: formatMoney(uncosted.product, currency),
                    })}
                  </small>
                ) : null}
              </div>
              <div className='analytics-mix-legend-item'>
                <p>
                  <span
                    className='report-trend-dot'
                    style={{ backgroundColor: profitReportServiceColor }}
                    aria-hidden='true'
                  />{' '}
                  {t('accounting.profit.types.service')}:{' '}
                  {formatPercent(mix.servicePct)}
                  {' · '}
                  {formatChartValue(mix.service, chartMetric, currency)}
                </p>
                {chartMetric === 'profit' && uncosted.service > 0 ? (
                  <small className='muted-copy finance-mix-uncosted-note'>
                    {t('accounting.profit.charts.mixMissingCostLine', {
                      amount: formatMoney(uncosted.service, currency),
                    })}
                  </small>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </AnalyticsSectionCard>

      <AnalyticsSectionCard
        id="accounting-reports-leaders-top-items"
        variant="finance"
        className="finance-profit-leaders-panel"
        eyebrow={t('accounting.profit.charts.topSection')}
        title={t('accounting.profit.charts.topTitle')}
        actions={
          <div
            className='period-toggle'
            role='tablist'
            aria-label={t(
              'accounting.profit.charts.leadersMetricAria',
            )}
          >
            {profitReportLeadersMetricOptions.map((option) => (
              <button
                key={option.value}
                type='button'
                className={
                  option.value === leadersMetric
                    ? 'period-button period-button-active'
                    : 'period-button'
                }
                onClick={() => setLeadersMetric(option.value)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        }
        collapsible={Boolean(isSectionCollapsed)}
        isCollapsed={
          isSectionCollapsed
            ? isSectionCollapsed('accounting-reports-leaders-top-items')
            : false
        }
        onCollapsedChange={(collapsed) => {
          if (onSetSectionCollapsed) {
            onSetSectionCollapsed(
              'accounting-reports-leaders-top-items',
              collapsed,
            );
          } else if (onToggleSectionCollapse) {
            onToggleSectionCollapse('accounting-reports-leaders-top-items');
          }
        }}
      >
        {distributionRows.length === 0 ? (
          <p className='empty-state'>
            {t('accounting.profit.charts.empty')}
          </p>
        ) : (
          <div className='finance-cashbox-distribution'>
            {distributionRows.map((row) => (
              <div
                key={row.key}
                className='finance-distribution-row finance-profit-chart-row'
              >
                <div>
                  <span title={row.name}>{row.name}</span>
                  <strong>{formatLeadersValue(row.value)}</strong>
                </div>
                <div className='finance-distribution-track'>
                  <span
                    style={{
                      width: `${Math.max(row.sharePercent, 2)}%`,
                      backgroundColor:
                        row.value < 0
                          ? 'var(--color-danger)'
                          : row.type === 'service'
                            ? profitReportServiceColor
                            : profitReportProductColor,
                    }}
                  />
                </div>
                <small>{formatPercent(row.sharePercent)}</small>
              </div>
            ))}
          </div>
        )}
      </AnalyticsSectionCard>

      <AnalyticsSectionCard
        id="accounting-reports-leaders-top-three"
        variant="finance"
        className="finance-profit-comparison-panel"
        eyebrow={t('accounting.profit.charts.topSection')}
        title={t('accounting.profit.charts.comparisonTitle')}
        collapsible={Boolean(isSectionCollapsed)}
        isCollapsed={
          isSectionCollapsed
            ? isSectionCollapsed('accounting-reports-leaders-top-three')
            : false
        }
        onCollapsedChange={(collapsed) => {
          if (onSetSectionCollapsed) {
            onSetSectionCollapsed(
              'accounting-reports-leaders-top-three',
              collapsed,
            );
          } else if (onToggleSectionCollapse) {
            onToggleSectionCollapse('accounting-reports-leaders-top-three');
          }
        }}
      >
        {topBarRows.length === 0 ? (
          <p className='empty-state'>
            {t('accounting.profit.charts.empty')}
          </p>
        ) : (
          <div className='bar-chart'>
            {topBarRows.map((row, index) => {
              const heightPercent =
                (Math.abs(row.value) / maxBarValue) * 100;
              return (
                <div
                  key={row.key}
                  className='bar-chart-item finance-profit-bar-item'
                >
                  <strong>{formatLeadersValue(row.value)}</strong>
                  <div className='bar-chart-track'>
                    <span
                      className='bar-chart-bar'
                      style={{
                        height: `${Math.max(heightPercent, 8)}%`,
                        backgroundColor:
                          row.value < 0
                            ? 'var(--color-danger)'
                            : profitReportChartBarColors[
                                index %
                                  profitReportChartBarColors.length
                              ],
                      }}
                    />
                  </div>
                  <TruncatedTextTooltip
                    text={row.name}
                    className='finance-profit-bar-label'
                  >
                    {row.name}
                  </TruncatedTextTooltip>
                </div>
              );
            })}
          </div>
        )}
      </AnalyticsSectionCard>

      <AnalyticsSectionCard
        id="accounting-reports-cashflow"
        variant="finance"
        className="finance-profit-waterfall-panel"
        eyebrow={t('accounting.profit.charts.waterfallSection')}
        title={t('accounting.profit.charts.waterfallTitle')}
        collapsible={Boolean(isSectionCollapsed)}
        isCollapsed={
          isSectionCollapsed
            ? isSectionCollapsed('accounting-reports-cashflow')
            : false
        }
        onCollapsedChange={(collapsed) => {
          if (onSetSectionCollapsed) {
            onSetSectionCollapsed('accounting-reports-cashflow', collapsed);
          } else if (onToggleSectionCollapse) {
            onToggleSectionCollapse('accounting-reports-cashflow');
          }
        }}
      >
        {outflowTotal <= 0 ? (
          <p className='empty-state'>
            {t('accounting.profit.charts.empty')}
          </p>
        ) : (
          <>
            <div className='analytics-payments-bar finance-profit-waterfall-bar'>
              <span
                className='finance-profit-wf-collected'
                style={{ width: `${share(cash.collected)}%` }}
              />
              <span
                className='finance-profit-wf-purchases'
                style={{
                  width: `${share(cash.inventoryPurchases)}%`,
                }}
              />
              <span
                className='finance-profit-wf-opex'
                style={{ width: `${share(cash.opex)}%` }}
              />
              <span
                className='finance-profit-wf-refunds'
                style={{ width: `${share(cash.refunds)}%` }}
              />
            </div>
            <div className='finance-profit-waterfall-legend'>
              <div>
                <span>{t('accounting.profit.kpis.collected')}</span>
                <strong>
                  {formatMoney(cash.collected, currency)}
                </strong>
              </div>
              <div>
                <span>{t('accounting.profit.kpis.purchases')}</span>
                <strong>
                  {formatMoney(cash.inventoryPurchases, currency)}
                </strong>
              </div>
              <div>
                <span>{t('accounting.profit.kpis.opex')}</span>
                <strong>{formatMoney(cash.opex, currency)}</strong>
              </div>
              <div>
                <span>{t('accounting.profit.kpis.refunds')}</span>
                <strong>{formatMoney(cash.refunds, currency)}</strong>
              </div>
              <div>
                <span>{t('accounting.profit.kpis.netCash')}</span>
                <strong
                  className={
                    cash.net < 0
                      ? 'finance-profit-kpi-negative'
                      : 'finance-profit-kpi-positive'
                  }
                >
                  {formatMoney(cash.net, currency)}
                </strong>
              </div>
            </div>
          </>
        )}
      </AnalyticsSectionCard>
    </div>
  );
};

export const AccountingProfitExpenseBars = ({
  rows,
  refunds,
  currency,
}: {
  rows: ProfitCashCategoryRow[];
  refunds: number;
  currency: string;
}) => {
  const { t } = useTranslation();
  const categoriesQuery = useFinanceCategoriesQuery();
  const categories = categoriesQuery.data ?? [];
  const displayRows = categoriesQuery.data
    ? foldUnknownOpexCategories(
        rows,
        categoriesQuery.data.map((category) => category.slug),
      )
    : rows;
  const total =
    displayRows.reduce((sum, row) => sum + row.amount, 0) +
    Math.max(refunds, 0);

  if (displayRows.length === 0 && refunds <= 0) {
    return (
      <p className='empty-state'>
        {t('accounting.profit.noExpenses')}
      </p>
    );
  }

  return (
    <div className='finance-cashbox-distribution'>
      {displayRows.map((row) => {
        const sharePct = total > 0 ? (row.amount / total) * 100 : 0;
        return (
          <div
            key={row.category}
            className='finance-distribution-row'
          >
            <div>
              <span>
                {getFinanceCategoryLabel(row.category, t, categories)}
              </span>
              <strong>{formatMoney(row.amount, currency)}</strong>
            </div>
            <div className='finance-distribution-track'>
              <span
                style={{
                  width: `${Math.max(sharePct, 2)}%`,
                  backgroundColor: profitReportCogsColor,
                }}
              />
            </div>
            <small>
              {t('accounting.profit.expenseCount', {
                count: row.count,
              })}
            </small>
          </div>
        );
      })}
      {refunds > 0 ? (
        <div className='finance-distribution-row'>
          <div>
            <span>{t('accounting.profit.kpis.refunds')}</span>
            <strong>{formatMoney(refunds, currency)}</strong>
          </div>
          <div className='finance-distribution-track'>
            <span
              style={{
                width: `${Math.max(total > 0 ? (refunds / total) * 100 : 0, 2)}%`,
                backgroundColor: 'var(--color-danger)',
              }}
            />
          </div>
          <small>
            {formatPercent(total > 0 ? (refunds / total) * 100 : 0)}
          </small>
        </div>
      ) : null}
    </div>
  );
};
