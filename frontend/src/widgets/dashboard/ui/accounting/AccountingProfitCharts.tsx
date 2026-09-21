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
import { formatMoney, formatPercent } from '../../model/accounting';
import {
  buildProfitChartRows,
  buildProfitMixShare,
  profitReportCogsColor,
  profitReportChartBarColors,
  profitReportLeadersLimit,
  profitReportLeadersMetricOptions,
  profitReportProductColor,
  profitReportServiceColor,
  type ProfitReportChartMetric,
  type ProfitReportLeadersMetric,
} from '../../model/profit-report';

const mixRadius = 52;
const mixCirc = 2 * Math.PI * mixRadius;

export interface AccountingProfitChartsProps {
  rows: ProfitMarginRow[];
  chartMetric: ProfitReportChartMetric;
  currency: string;
  cash: {
    collected: number;
    inventoryPurchases: number;
    opex: number;
    refunds: number;
    net: number;
  };
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
> = ({ rows, chartMetric, currency, cash }) => {
  const { t } = useTranslation();
  const [leadersMetric, setLeadersMetric] =
    useState<ProfitReportLeadersMetric>('profit');
  const mix = buildProfitMixShare(rows, chartMetric);
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
      <section className='finance-info-panel finance-profit-mix-panel'>
        <div className='analytics-panel-header'>
          <div>
            <p className='section-label'>
              {t('accounting.profit.charts.mixSection')}
            </p>
            <h3>{t('accounting.profit.charts.mixTitle')}</h3>
          </div>
        </div>
        {mixTotal <= 0 ? (
          <p className='empty-state'>
            {t('accounting.profit.charts.empty')}
          </p>
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
            <div>
              <p>
                {t('accounting.profit.types.product')}:{' '}
                {formatPercent(mix.productPct)}
                {' · '}
                {formatChartValue(mix.product, chartMetric, currency)}
              </p>
              <p>
                {t('accounting.profit.types.service')}:{' '}
                {formatPercent(mix.servicePct)}
                {' · '}
                {formatChartValue(mix.service, chartMetric, currency)}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className='finance-info-panel finance-profit-leaders-panel'>
        <div className='analytics-panel-header'>
          <div>
            <p className='section-label'>
              {t('accounting.profit.charts.topSection')}
            </p>
            <h3>{t('accounting.profit.charts.topTitle')}</h3>
          </div>
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
        </div>
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
      </section>

      <section className='finance-info-panel finance-profit-comparison-panel'>
        <div className='analytics-panel-header'>
          <div>
            <p className='section-label'>
              {t('accounting.profit.charts.topSection')}
            </p>
            <h3>{t('accounting.profit.charts.comparisonTitle')}</h3>
          </div>
        </div>
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
      </section>

      <section className='finance-info-panel finance-profit-waterfall-panel'>
        <div className='analytics-panel-header'>
          <div>
            <p className='section-label'>
              {t('accounting.profit.charts.waterfallSection')}
            </p>
            <h3>{t('accounting.profit.charts.waterfallTitle')}</h3>
          </div>
        </div>
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
      </section>
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
