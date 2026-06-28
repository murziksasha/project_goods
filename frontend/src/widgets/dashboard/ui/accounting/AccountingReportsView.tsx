import { useTranslation } from 'react-i18next';
import type { FinanceTransactionType } from '../../../../entities/finance/model/types';
import {
  formatCurrencyTotals,
  formatDateDdMmYyyy,
  formatMoney,
  formatPercent,
  type FinanceOverview,
} from '../../model/accounting';
import { formatMetric } from '../../model/sales-analytics';

type AccountingReportsViewProps = {
  financeOverview: FinanceOverview;
};

const turnoverTypeLabelKeys: Record<FinanceTransactionType, string> = {
  deposit: 'accounting.reports.deposits',
  withdraw: 'accounting.reports.withdrawals',
  transfer: 'accounting.reports.transfers',
};

const transactionTypeLabelKeys: Record<FinanceTransactionType, string> = {
  deposit: 'accounting.cashboxes.deposit',
  withdraw: 'accounting.cashboxes.withdraw',
  transfer: 'accounting.cashboxes.transfer',
};

export const AccountingReportsView = ({
  financeOverview,
}: AccountingReportsViewProps) => {
  const { t } = useTranslation();

  return (
    <section className='finance-information'>
      <div className='finance-information-header'>
        <div>
          <p className='section-label'>{t('accounting.reports.sectionLabel')}</p>
          <h2>{t('accounting.reports.title')}</h2>
        </div>
        <div className='finance-information-status'>
          <span>
            {t('accounting.reports.activeCashboxesStatus', {
              count: financeOverview.activeCashboxCount,
            })}
          </span>
          {financeOverview.archivedCashboxCount > 0 ? (
            <span>
              {t('accounting.reports.archivedStatus', {
                count: financeOverview.archivedCashboxCount,
              })}
            </span>
          ) : null}
        </div>
      </div>

      <div className='finance-report-grid finance-report-grid-wide'>
        <article className='analytics-summary-card'>
          <span className='metric-label'>{t('accounting.reports.transactions')}</span>
          <strong>{formatMetric(financeOverview.transactionCount)}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>{t('accounting.reports.todayOperations')}</span>
          <strong>{formatMetric(financeOverview.todayTransactionCount)}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('accounting.reports.pendingSupplierPayments')}
          </span>
          <strong>{formatMoney(financeOverview.pendingSupplierTotal, 'UAH')}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>{t('accounting.reports.paymentQueue')}</span>
          <strong>{formatMetric(financeOverview.pendingSupplierCount)}</strong>
        </article>
      </div>

      <div className='finance-information-grid'>
        <section className='finance-info-panel'>
          <div className='analytics-panel-header'>
            <div>
              <p className='section-label'>{t('accounting.reports.balancesSectionLabel')}</p>
              <h3>{t('accounting.reports.currencyTotals')}</h3>
            </div>
          </div>
          <div className='finance-currency-overview'>
            {financeOverview.currencyRows.length === 0 ? (
              <p className='empty-state'>{t('accounting.reports.noBalancesYet')}</p>
            ) : (
              financeOverview.currencyRows.map((row) => (
                <div key={row.currency} className='finance-currency-row'>
                  <div>
                    <span className='metric-label'>{row.currency}</span>
                    <strong>{formatMoney(row.total, row.currency)}</strong>
                  </div>
                  <span>
                    {t('accounting.reports.todayTurnover', {
                      amount: formatMoney(row.todayTurnover, row.currency),
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className='finance-info-panel'>
          <div className='analytics-panel-header'>
            <div>
              <p className='section-label'>{t('accounting.reports.turnoverSectionLabel')}</p>
              <h3>{t('accounting.reports.todaySplit')}</h3>
            </div>
          </div>
          <div className='finance-turnover-split'>
            {(
              ['deposit', 'withdraw', 'transfer'] as FinanceTransactionType[]
            ).map((type) => (
              <div
                key={type}
                className={`finance-turnover-item finance-turnover-${type}`}
              >
                <span>{t(turnoverTypeLabelKeys[type])}</span>
                <strong>
                  {formatCurrencyTotals(financeOverview.todayByType[type])}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className='finance-info-panel finance-info-panel-wide'>
          <div className='analytics-panel-header'>
            <div>
              <p className='section-label'>{t('accounting.reports.cashboxesSectionLabel')}</p>
              <h3>{t('accounting.reports.distribution')}</h3>
            </div>
          </div>
          <div className='finance-cashbox-distribution'>
            {financeOverview.currencyRows.flatMap((row) =>
              row.cashboxes.map((cashbox) => {
                const share =
                  row.total > 0 ? (cashbox.balance / row.total) * 100 : 0;
                return (
                  <div
                    key={`${row.currency}-${cashbox.id}`}
                    className='finance-distribution-row'
                  >
                    <div>
                      <span title={cashbox.name}>{cashbox.name}</span>
                      <strong>{formatMoney(cashbox.balance, row.currency)}</strong>
                    </div>
                    <div className='finance-distribution-track'>
                      <span
                        style={{ width: `${Math.max(Math.min(share, 100), 2)}%` }}
                      />
                    </div>
                    <small>{formatPercent(share)}</small>
                  </div>
                );
              }),
            )}
          </div>
        </section>

        <section className='finance-info-panel finance-info-panel-wide'>
          <div className='analytics-panel-header'>
            <div>
              <p className='section-label'>{t('accounting.reports.activitySectionLabel')}</p>
              <h3>{t('accounting.reports.recentOperations')}</h3>
            </div>
          </div>
          <div className='finance-recent-list'>
            {financeOverview.recentTransactions.length === 0 ? (
              <p className='empty-state'>
                {t('accounting.reports.noOperationsYet')}
              </p>
            ) : (
              financeOverview.recentTransactions.map((transaction) => (
                <div key={transaction.id} className='finance-recent-row'>
                  <span
                    className={`finance-transaction-type finance-transaction-type-${transaction.type}`}
                  >
                    {t(transactionTypeLabelKeys[transaction.type])}
                  </span>
                  <div>
                    <strong>
                      {formatMoney(transaction.amount, transaction.currency)}
                    </strong>
                    <p>
                      {[
                        transaction.fromCashbox?.name,
                        transaction.toCashbox?.name,
                      ]
                        .filter(Boolean)
                        .join(' -> ') ||
                        transaction.note ||
                        t('accounting.reports.manualOperation')}
                    </p>
                  </div>
                  <time>{formatDateDdMmYyyy(transaction.transactionDate)}</time>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
};