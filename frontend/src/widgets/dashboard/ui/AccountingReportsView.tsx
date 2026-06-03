import type { FinanceTransactionType } from '../../../entities/finance/model/types';
import {
  formatCurrencyTotals,
  formatDateDdMmYyyy,
  formatMoney,
  formatPercent,
  transactionLabels,
  type FinanceOverview,
} from '../model/accounting';
import { formatMetric } from '../model/sales-analytics';

type AccountingReportsViewProps = {
  financeOverview: FinanceOverview;
};

export const AccountingReportsView = ({
  financeOverview,
}: AccountingReportsViewProps) => (
  <section className='finance-information'>
    <div className='finance-information-header'>
      <div>
        <p className='section-label'>Finance overview</p>
        <h2>Accounting information</h2>
      </div>
      <div className='finance-information-status'>
        <span>{`${financeOverview.activeCashboxCount} active cashboxes`}</span>
        {financeOverview.archivedCashboxCount > 0 ? (
          <span>{`${financeOverview.archivedCashboxCount} archived`}</span>
        ) : null}
      </div>
    </div>

    <div className='finance-report-grid finance-report-grid-wide'>
      <article className='analytics-summary-card'>
        <span className='metric-label'>Transactions</span>
        <strong>{formatMetric(financeOverview.transactionCount)}</strong>
      </article>
      <article className='analytics-summary-card'>
        <span className='metric-label'>Today operations</span>
        <strong>{formatMetric(financeOverview.todayTransactionCount)}</strong>
      </article>
      <article className='analytics-summary-card'>
        <span className='metric-label'>Pending supplier payments</span>
        <strong>{formatMoney(financeOverview.pendingSupplierTotal, 'UAH')}</strong>
      </article>
      <article className='analytics-summary-card'>
        <span className='metric-label'>Payment queue</span>
        <strong>{formatMetric(financeOverview.pendingSupplierCount)}</strong>
      </article>
    </div>

    <div className='finance-information-grid'>
      <section className='finance-info-panel'>
        <div className='analytics-panel-header'>
          <div>
            <p className='section-label'>Balances</p>
            <h3>Currency totals</h3>
          </div>
        </div>
        <div className='finance-currency-overview'>
          {financeOverview.currencyRows.length === 0 ? (
            <p className='empty-state'>No balances yet.</p>
          ) : (
            financeOverview.currencyRows.map((row) => (
              <div key={row.currency} className='finance-currency-row'>
                <div>
                  <span className='metric-label'>{row.currency}</span>
                  <strong>{formatMoney(row.total, row.currency)}</strong>
                </div>
                <span>{`Today ${formatMoney(row.todayTurnover, row.currency)}`}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className='finance-info-panel'>
        <div className='analytics-panel-header'>
          <div>
            <p className='section-label'>Turnover</p>
            <h3>Today split</h3>
          </div>
        </div>
        <div className='finance-turnover-split'>
          {([
            ['deposit', 'Deposits'],
            ['withdraw', 'Withdrawals'],
            ['transfer', 'Transfers'],
          ] as Array<[FinanceTransactionType, string]>).map(([type, label]) => (
            <div
              key={type}
              className={`finance-turnover-item finance-turnover-${type}`}
            >
              <span>{label}</span>
              <strong>{formatCurrencyTotals(financeOverview.todayByType[type])}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className='finance-info-panel finance-info-panel-wide'>
        <div className='analytics-panel-header'>
          <div>
            <p className='section-label'>Cashboxes</p>
            <h3>Distribution</h3>
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
            <p className='section-label'>Activity</p>
            <h3>Recent operations</h3>
          </div>
        </div>
        <div className='finance-recent-list'>
          {financeOverview.recentTransactions.length === 0 ? (
            <p className='empty-state'>No finance operations yet.</p>
          ) : (
            financeOverview.recentTransactions.map((transaction) => (
              <div key={transaction.id} className='finance-recent-row'>
                <span
                  className={`finance-transaction-type finance-transaction-type-${transaction.type}`}
                >
                  {transactionLabels[transaction.type]}
                </span>
                <div>
                  <strong>{formatMoney(transaction.amount, transaction.currency)}</strong>
                  <p>
                    {[
                      transaction.fromCashbox?.name,
                      transaction.toCashbox?.name,
                    ]
                      .filter(Boolean)
                      .join(' -> ') ||
                      transaction.note ||
                      'Manual operation'}
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
