import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCashbox,
  createFinanceTransaction,
  getCashboxes,
  getFinanceReport,
  getFinanceTransactions,
} from '../../../entities/finance/api/financeApi';
import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceCurrency,
  FinanceReport,
  FinanceTransaction,
  FinanceTransactionType,
} from '../../../entities/finance/model/types';
import { formatDateTime } from '../../../shared/lib/format';

type AccountingPanelProps = {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

type AccountingTab = 'cashboxes' | 'transactions' | 'reports';

const currencyOptions: FinanceCurrency[] = ['UAH', 'USD'];
const transactionLabels: Record<FinanceTransactionType, string> = {
  withdraw: 'Выдача',
  deposit: 'Внесення',
  transfer: 'Переміщення',
};

const formatMoney = (value: number, currency: FinanceCurrency) =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;

const initialTransactionForm: CreateFinanceTransactionPayload = {
  type: 'deposit',
  amount: '',
  currency: 'UAH',
  fromCashboxId: '',
  toCashboxId: '',
  note: '',
};

export const AccountingPanel = ({ onError, onSuccess }: AccountingPanelProps) => {
  const [activeTab, setActiveTab] = useState<AccountingTab>('cashboxes');
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newCashboxName, setNewCashboxName] = useState('');
  const [transactionForm, setTransactionForm] = useState(initialTransactionForm);

  const firstCashboxId = cashboxes[0]?.id ?? '';
  const secondCashboxId = cashboxes.find((cashbox) => cashbox.id !== firstCashboxId)?.id ?? '';

  const refreshFinance = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cashboxesData, transactionsData, reportData] = await Promise.all([
        getCashboxes(),
        getFinanceTransactions(),
        getFinanceReport(),
      ]);
      setCashboxes(cashboxesData);
      setTransactions(transactionsData);
      setReport(reportData);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load finance data.');
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void refreshFinance();
  }, [refreshFinance]);

  useEffect(() => {
    const refreshOnOrderPayment = () => {
      void refreshFinance();
    };

    window.addEventListener('project-goods:finance-updated', refreshOnOrderPayment);

    return () => {
      window.removeEventListener('project-goods:finance-updated', refreshOnOrderPayment);
    };
  }, [refreshFinance]);

  const totals = useMemo(
    () =>
      cashboxes.reduce(
        (summary, cashbox) => ({
          UAH: summary.UAH + cashbox.balances.UAH,
          USD: summary.USD + cashbox.balances.USD,
        }),
        { UAH: 0, USD: 0 },
      ),
    [cashboxes],
  );

  const startTransaction = (type: FinanceTransactionType, cashbox: Cashbox) => {
    setActiveTab('cashboxes');
    setTransactionForm({
      ...initialTransactionForm,
      type,
      fromCashboxId: type === 'withdraw' || type === 'transfer' ? cashbox.id : '',
      toCashboxId: type === 'deposit' ? cashbox.id : secondCashboxId,
    });
  };

  const handleCreateCashbox = async () => {
    if (!newCashboxName.trim()) return;
    setIsSaving(true);
    try {
      await createCashbox({ name: newCashboxName });
      setNewCashboxName('');
      onSuccess('Cashbox created.');
      await refreshFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to create cashbox.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTransaction = async () => {
    setIsSaving(true);
    try {
      await createFinanceTransaction(transactionForm);
      setTransactionForm({
        ...initialTransactionForm,
        toCashboxId: firstCashboxId,
      });
      onSuccess('Finance transaction saved.');
      await refreshFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to save transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderCashboxes = () => (
    <>
      <div className="finance-toolbar">
        <div className="finance-total-strip">
          <strong>{formatMoney(totals.UAH, 'UAH')}</strong>
          <span>{formatMoney(totals.USD, 'USD')}</span>
        </div>
        <div className="finance-add-cashbox">
          <input
            value={newCashboxName}
            onChange={(event) => setNewCashboxName(event.target.value)}
            placeholder="Новая касса"
          />
          <button type="button" className="orders-create-button" onClick={handleCreateCashbox} disabled={isSaving}>
            Добавить кассу
          </button>
        </div>
      </div>

      <div className="finance-cashbox-grid">
        {cashboxes.map((cashbox) => (
          <article key={cashbox.id} className="finance-cashbox-card">
            <div className="finance-cashbox-heading">
              <h3>{cashbox.name}</h3>
              {cashbox.isDefault ? <span>Default</span> : null}
            </div>
            <strong>{formatMoney(cashbox.balances.UAH, 'UAH')}</strong>
            <p>{formatMoney(cashbox.balances.USD, 'USD')}</p>
            <div className="finance-cashbox-actions">
              <button type="button" onClick={() => startTransaction('withdraw', cashbox)}>
                Выдача
              </button>
              <button type="button" onClick={() => startTransaction('deposit', cashbox)}>
                Внесення
              </button>
              <button type="button" onClick={() => startTransaction('transfer', cashbox)}>
                Переміщення
              </button>
              <button type="button" onClick={() => setActiveTab('reports')}>
                Звіти
              </button>
            </div>
          </article>
        ))}
      </div>

      <section className="finance-operation-panel">
        <div className="panel-header">
          <div>
            <p className="section-label">Операция</p>
            <h2>{transactionLabels[transactionForm.type]}</h2>
          </div>
        </div>
        <div className="finance-operation-grid">
          <label className="field">
            <span>Тип</span>
            <select
              value={transactionForm.type}
              onChange={(event) =>
                setTransactionForm((current) => ({
                  ...current,
                  type: event.target.value as FinanceTransactionType,
                }))
              }
            >
              <option value="deposit">Внесення</option>
              <option value="withdraw">Выдача</option>
              <option value="transfer">Переміщення</option>
            </select>
          </label>
          <label className="field">
            <span>Сумма</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={transactionForm.amount}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, amount: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Валюта</span>
            <select
              value={transactionForm.currency}
              onChange={(event) =>
                setTransactionForm((current) => ({
                  ...current,
                  currency: event.target.value as FinanceCurrency,
                }))
              }
            >
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Из кассы</span>
            <select
              value={transactionForm.fromCashboxId}
              disabled={transactionForm.type === 'deposit'}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, fromCashboxId: event.target.value }))
              }
            >
              <option value="">-</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>В кассу</span>
            <select
              value={transactionForm.toCashboxId}
              disabled={transactionForm.type === 'withdraw'}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, toCashboxId: event.target.value }))
              }
            >
              <option value="">-</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Комментарий</span>
            <input
              value={transactionForm.note}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, note: event.target.value }))
              }
            />
          </label>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={handleCreateTransaction}
          disabled={isSaving || !transactionForm.amount}
        >
          {isSaving ? 'Saving...' : 'Save operation'}
        </button>
      </section>
    </>
  );

  const renderTransactions = () => (
    <div className="finance-table-wrap">
      <table className="orders-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>From</th>
            <th>To</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={6} className="orders-empty">
                Transactions not found.
              </td>
            </tr>
          ) : (
            transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{formatDateTime(transaction.transactionDate)}</td>
                <td>{transactionLabels[transaction.type]}</td>
                <td>{formatMoney(transaction.amount, transaction.currency)}</td>
                <td>{transaction.fromCashbox?.name ?? '-'}</td>
                <td>{transaction.toCashbox?.name ?? '-'}</td>
                <td>{transaction.note || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderReports = () => (
    <div className="finance-report-grid">
      <article className="analytics-summary-card">
        <span className="metric-label">Всего касс</span>
        <strong>{report?.cashboxCount ?? cashboxes.length}</strong>
      </article>
      <article className="analytics-summary-card">
        <span className="metric-label">Баланс UAH</span>
        <strong>{formatMoney(report?.totals.UAH ?? totals.UAH, 'UAH')}</strong>
      </article>
      <article className="analytics-summary-card">
        <span className="metric-label">Баланс USD</span>
        <strong>{formatMoney(report?.totals.USD ?? totals.USD, 'USD')}</strong>
      </article>
      <article className="analytics-summary-card">
        <span className="metric-label">Операций сегодня</span>
        <strong>{report?.todayTransactionCount ?? 0}</strong>
      </article>
      <article className="finance-wide-report">
        <h3>Сегодняшний оборот</h3>
        <p>{formatMoney(report?.todayTurnover.UAH ?? 0, 'UAH')}</p>
        <p>{formatMoney(report?.todayTurnover.USD ?? 0, 'USD')}</p>
      </article>
    </div>
  );

  return (
    <section className="orders-page finance-page">
      <div className="orders-tabs" role="tablist" aria-label="Accounting sections">
        {[
          ['cashboxes', 'Каси'],
          ['transactions', 'Транзакції'],
          ['reports', 'Звіти'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? 'orders-tab orders-tab-active' : 'orders-tab'}
            onClick={() => setActiveTab(key as AccountingTab)}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="empty-state">Loading finance data...</p>
      ) : activeTab === 'transactions' ? (
        renderTransactions()
      ) : activeTab === 'reports' ? (
        renderReports()
      ) : (
        renderCashboxes()
      )}
    </section>
  );
};
