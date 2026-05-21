import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCashbox,
  createFinanceTransaction,
  getCashboxes,
  getFinanceReport,
  getFinanceTransactions,
  getSupplierOrdersForPayment,
  issueSupplierOrderWithoutPayment,
  paySupplierOrder,
} from '../../../entities/finance/api/financeApi';
import { getSupplierOrders } from '../../../entities/supplier-order/api/supplierOrderApi';
import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceCurrency,
  FinanceReport,
  FinanceTransaction,
  FinanceTransactionType,
  SupplierOrderPaymentQueueItem,
} from '../../../entities/finance/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import { SupplierOrderModal } from './SupplierOrderModal';
import { formatDateTime } from '../../../shared/lib/format';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';

type AccountingPanelProps = {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  sales: Sale[];
  onOpenSaleCard: (sale: { id: string; kind: 'repair' | 'sale' }) => void;
};

type AccountingTab = 'cashboxes' | 'transactions' | 'orders' | 'reports';
const accountingTabStorageKey = 'project-goods.accounting-tab';
const accountingCashboxOrderStorageKey = 'project-goods.accounting-cashbox-order';

const currencyOptions: FinanceCurrency[] = ['UAH', 'USD'];
const transactionLabels: Record<FinanceTransactionType, string> = {
  withdraw: 'Withdraw',
  deposit: 'Deposit',
  transfer: 'Transfer',
};

const formatMoney = (value: number, currency: FinanceCurrency) =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
const formatDateDdMmYyyy = (value: string) => {
  if (!value) return '-';
  const normalized = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return formatDateTime(value);
  }
  const [year, month, day] = normalized.split('-');
  return `${day}.${month}.${year}`;
};

const formatTransactionDayLabel = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateDdMmYyyy(value);
  const label = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return label.slice(0, 1).toUpperCase() + label.slice(1);
};

const initialTransactionForm: CreateFinanceTransactionPayload = {
  type: 'deposit',
  amount: '',
  currency: 'UAH',
  fromCashboxId: '',
  toCashboxId: '',
  note: '',
};

type TransactionFilters = {
  type: '' | FinanceTransactionType;
  currency: '' | FinanceCurrency;
  fromCashboxId: string;
  toCashboxId: string;
  note: string;
  dateFrom: string;
  dateTo: string;
  sortBy: 'date' | 'type' | 'amount' | 'currency' | 'from' | 'to';
  sortDirection: 'asc' | 'desc';
};

const initialTransactionFilters: TransactionFilters = {
  type: '',
  currency: '',
  fromCashboxId: '',
  toCashboxId: '',
  note: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'date',
  sortDirection: 'desc',
};

const applyCashboxOrder = (items: Cashbox[], orderedIds: string[]) => {
  if (orderedIds.length === 0) return items;
  const byId = new Map(items.map((cashbox) => [cashbox.id, cashbox]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((cashbox): cashbox is Cashbox => Boolean(cashbox));
  const unordered = items.filter((cashbox) => !orderedIds.includes(cashbox.id));
  return [...ordered, ...unordered];
};

export const AccountingPanel = ({
  onError,
  onSuccess,
  sales,
  onOpenSaleCard,
}: AccountingPanelProps) => {
  const [activeTab, setActiveTab] = useState<AccountingTab>(() => {
    try {
      const storedTab = window.localStorage.getItem(accountingTabStorageKey);
      return storedTab === 'cashboxes' ||
        storedTab === 'transactions' ||
        storedTab === 'orders' ||
        storedTab === 'reports'
        ? storedTab
        : 'cashboxes';
    } catch {
      return 'cashboxes';
    }
  });
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
  const [supplierOrdersQueue, setSupplierOrdersQueue] = useState<SupplierOrderPaymentQueueItem[]>([]);
  const [selectedSupplierOrder, setSelectedSupplierOrder] = useState<SupplierOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newCashboxName, setNewCashboxName] = useState('');
  const [transactionForm, setTransactionForm] = useState(initialTransactionForm);
  const [isTransactionsFilterOpen, setIsTransactionsFilterOpen] = useState(false);
  const [isTransactionsDateFilterOpen, setIsTransactionsDateFilterOpen] = useState(false);
  const [selectedTransactionCashboxId, setSelectedTransactionCashboxId] = useState('');
  const [draftTransactionFilters, setDraftTransactionFilters] =
    useState<TransactionFilters>(initialTransactionFilters);
  const [appliedTransactionFilters, setAppliedTransactionFilters] =
    useState<TransactionFilters>(initialTransactionFilters);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPageSize, setTransactionsPageSize] = useState(30);
  const [draggedCashboxId, setDraggedCashboxId] = useState<string | null>(null);
  const [isCashboxesOrderHydrated, setIsCashboxesOrderHydrated] = useState(false);
  const [withoutPaymentOrder, setWithoutPaymentOrder] = useState<SupplierOrderPaymentQueueItem | null>(null);

  const firstCashboxId = cashboxes[0]?.id ?? '';
  const secondCashboxId = cashboxes.find((cashbox) => cashbox.id !== firstCashboxId)?.id ?? '';

  const refreshFinance = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cashboxesData, transactionsData, reportData, supplierOrdersData] = await Promise.all([
        getCashboxes(),
        getFinanceTransactions(),
        getFinanceReport(),
        getSupplierOrdersForPayment(),
      ]);
      const allSupplierOrders = await getSupplierOrders();
      let orderedCashboxes = cashboxesData;
      try {
        const storedOrder = JSON.parse(
          window.localStorage.getItem(accountingCashboxOrderStorageKey) ?? '[]',
        ) as string[];
        if (Array.isArray(storedOrder)) {
          orderedCashboxes = applyCashboxOrder(cashboxesData, storedOrder);
        }
      } catch {
        orderedCashboxes = cashboxesData;
      }
      setCashboxes(orderedCashboxes);
      setIsCashboxesOrderHydrated(true);
      setTransactions(transactionsData);
      setReport(reportData);
      setSupplierOrdersQueue(supplierOrdersData);
      setSupplierOrders(allSupplierOrders);
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

  useEffect(() => {
    window.localStorage.setItem(accountingTabStorageKey, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!isCashboxesOrderHydrated || cashboxes.length === 0) return;
    try {
      const order = cashboxes.map((cashbox) => cashbox.id);
      window.localStorage.setItem(
        accountingCashboxOrderStorageKey,
        JSON.stringify(order),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [cashboxes, isCashboxesOrderHydrated]);

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
      setTransactionForm({ ...initialTransactionForm, toCashboxId: firstCashboxId });
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
      <div className='finance-toolbar'>
        <div className='finance-total-strip'>
          <strong>{formatMoney(totals.UAH, 'UAH')}</strong>
          <span>{formatMoney(totals.USD, 'USD')}</span>
        </div>
        <div className='finance-add-cashbox'>
          <input value={newCashboxName} onChange={(event) => setNewCashboxName(event.target.value)} placeholder='New cashbox' />
          <button type='button' className='orders-create-button' onClick={handleCreateCashbox} disabled={isSaving}>
            Add cashbox
          </button>
        </div>
      </div>

      <div className='finance-cashbox-grid'>
        {cashboxes.map((cashbox) => (
          <article
            key={cashbox.id}
            className='finance-cashbox-card'
            draggable
            onDragStart={() => setDraggedCashboxId(cashbox.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (!draggedCashboxId || draggedCashboxId === cashbox.id) {
                setDraggedCashboxId(null);
                return;
              }
              setCashboxes((current) => {
                const fromIndex = current.findIndex((item) => item.id === draggedCashboxId);
                const toIndex = current.findIndex((item) => item.id === cashbox.id);
                if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
                  return current;
                }
                const next = [...current];
                const [moved] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, moved);
                return next;
              });
              setDraggedCashboxId(null);
            }}
            onDragEnd={() => setDraggedCashboxId(null)}
          >
            <div className='finance-cashbox-heading'>
              <h3>{cashbox.name}</h3>
              {cashbox.isDefault ? <span>Default</span> : null}
            </div>
            <strong>{formatMoney(cashbox.balances.UAH, 'UAH')}</strong>
            <p>{formatMoney(cashbox.balances.USD, 'USD')}</p>
            <div className='finance-cashbox-actions'>
              <button type='button' onClick={() => startTransaction('withdraw', cashbox)}>Withdraw</button>
              <button type='button' onClick={() => startTransaction('deposit', cashbox)}>Deposit</button>
              <button type='button' onClick={() => startTransaction('transfer', cashbox)}>Transfer</button>
              <button type='button' onClick={() => setActiveTab('reports')}>Reports</button>
            </div>
          </article>
        ))}
      </div>

      <section className='finance-operation-panel'>
        <div className='panel-header'>
          <div>
            <p className='section-label'>Operation</p>
            <h2>{transactionLabels[transactionForm.type]}</h2>
          </div>
        </div>
        <div className='finance-operation-grid'>
          <label className='field'>
            <span>Type</span>
            <select value={transactionForm.type} onChange={(event) => setTransactionForm((current) => ({ ...current, type: event.target.value as FinanceTransactionType }))}>
              <option value='deposit'>Deposit</option>
              <option value='withdraw'>Withdraw</option>
              <option value='transfer'>Transfer</option>
            </select>
          </label>
          <label className='field'>
            <span>Amount</span>
            <NumberStepper min={0} value={transactionForm.amount} onChange={(value) => setTransactionForm((current) => ({ ...current, amount: value }))} />
          </label>
          <label className='field'>
            <span>Currency</span>
            <select value={transactionForm.currency} onChange={(event) => setTransactionForm((current) => ({ ...current, currency: event.target.value as FinanceCurrency }))}>
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>From cashbox</span>
            <select value={transactionForm.fromCashboxId} disabled={transactionForm.type === 'deposit'} onChange={(event) => setTransactionForm((current) => ({ ...current, fromCashboxId: event.target.value }))}>
              <option value=''>-</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>{cashbox.name}</option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>To cashbox</span>
            <select value={transactionForm.toCashboxId} disabled={transactionForm.type === 'withdraw'} onChange={(event) => setTransactionForm((current) => ({ ...current, toCashboxId: event.target.value }))}>
              <option value=''>-</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>{cashbox.name}</option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>Comment</span>
            <input value={transactionForm.note} onChange={(event) => setTransactionForm((current) => ({ ...current, note: event.target.value }))} />
          </label>
        </div>
        <button type='button' className='primary-button' onClick={handleCreateTransaction} disabled={isSaving || !transactionForm.amount}>
          {isSaving ? 'Saving...' : 'Save operation'}
        </button>
      </section>
    </>
  );

  const balanceAfterByTransactionId = useMemo(() => {
    const balancesByCashboxCurrency = new Map<string, number>();
    cashboxes.forEach((cashbox) => {
      currencyOptions.forEach((currency) => {
        balancesByCashboxCurrency.set(
          `${cashbox.id}:${currency}`,
          cashbox.balances[currency],
        );
      });
    });

    const chronologicalDesc = [...transactions].sort((first, second) =>
      second.transactionDate.localeCompare(first.transactionDate),
    );
    const result: Record<string, number | null> = {};
    chronologicalDesc.forEach((transaction) => {
      const fromKey = transaction.fromCashbox?.id
        ? `${transaction.fromCashbox.id}:${transaction.currency}`
        : '';
      const toKey = transaction.toCashbox?.id
        ? `${transaction.toCashbox.id}:${transaction.currency}`
        : '';

      const senderBalanceAfter =
        fromKey.length > 0
          ? (balancesByCashboxCurrency.get(fromKey) ?? 0)
          : null;
      const recipientBalanceAfter =
        toKey.length > 0
          ? (balancesByCashboxCurrency.get(toKey) ?? 0)
          : null;

      if (transaction.type === 'deposit') {
        result[transaction.id] = recipientBalanceAfter;
      } else {
        result[transaction.id] = senderBalanceAfter;
      }

      if (transaction.fromCashbox?.id) {
        balancesByCashboxCurrency.set(
          fromKey,
          (senderBalanceAfter ?? 0) + transaction.amount,
        );
      }

      if (transaction.toCashbox?.id) {
        balancesByCashboxCurrency.set(
          toKey,
          (recipientBalanceAfter ?? 0) - transaction.amount,
        );
      }
    });
    return result;
  }, [cashboxes, transactions]);

  const filteredTransactions = useMemo(() => {
    const normalizedNote = appliedTransactionFilters.note.trim().toLowerCase();
    const filtered = transactions.filter((transaction) => {
      if (
        appliedTransactionFilters.type &&
        transaction.type !== appliedTransactionFilters.type
      ) {
        return false;
      }
      if (
        appliedTransactionFilters.currency &&
        transaction.currency !== appliedTransactionFilters.currency
      ) {
        return false;
      }
      if (
        appliedTransactionFilters.fromCashboxId &&
        transaction.fromCashbox?.id !== appliedTransactionFilters.fromCashboxId
      ) {
        return false;
      }
      if (
        appliedTransactionFilters.toCashboxId &&
        transaction.toCashbox?.id !== appliedTransactionFilters.toCashboxId
      ) {
        return false;
      }
      if (normalizedNote) {
        const transactionNote = transaction.note.trim().toLowerCase();
        if (!transactionNote.includes(normalizedNote)) {
          return false;
        }
      }
      if (
        selectedTransactionCashboxId &&
        transaction.fromCashbox?.id !== selectedTransactionCashboxId &&
        transaction.toCashbox?.id !== selectedTransactionCashboxId
      ) {
        return false;
      }
      if (appliedTransactionFilters.dateFrom) {
        const txDate = transaction.transactionDate.slice(0, 10);
        if (txDate < appliedTransactionFilters.dateFrom) {
          return false;
        }
      }
      if (appliedTransactionFilters.dateTo) {
        const txDate = transaction.transactionDate.slice(0, 10);
        if (txDate > appliedTransactionFilters.dateTo) {
          return false;
        }
      }
      return true;
    });

    const sorted = [...filtered].sort((first, second) => {
      const direction = appliedTransactionFilters.sortDirection === 'asc' ? 1 : -1;
      switch (appliedTransactionFilters.sortBy) {
        case 'type':
          return first.type.localeCompare(second.type) * direction;
        case 'amount':
          return (first.amount - second.amount) * direction;
        case 'currency':
          return first.currency.localeCompare(second.currency) * direction;
        case 'from':
          return (
            (first.fromCashbox?.name ?? '').localeCompare(second.fromCashbox?.name ?? '') *
            direction
          );
        case 'to':
          return (
            (first.toCashbox?.name ?? '').localeCompare(second.toCashbox?.name ?? '') *
            direction
          );
        case 'date':
        default:
          return first.transactionDate.localeCompare(second.transactionDate) * direction;
      }
    });

    return sorted;
  }, [appliedTransactionFilters, selectedTransactionCashboxId, transactions]);

  const paginatedTransactions = useMemo(() => {
    const start = (transactionsPage - 1) * transactionsPageSize;
    return filteredTransactions.slice(start, start + transactionsPageSize);
  }, [filteredTransactions, transactionsPage, transactionsPageSize]);

  const activeTransactionFiltersCount = useMemo(
    () =>
      (appliedTransactionFilters.type ? 1 : 0) +
      (appliedTransactionFilters.currency ? 1 : 0) +
      (appliedTransactionFilters.fromCashboxId ? 1 : 0) +
      (appliedTransactionFilters.toCashboxId ? 1 : 0) +
      (appliedTransactionFilters.note.trim() ? 1 : 0) +
      (appliedTransactionFilters.dateFrom ? 1 : 0) +
      (appliedTransactionFilters.dateTo ? 1 : 0),
    [appliedTransactionFilters],
  );

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / transactionsPageSize));
    if (transactionsPage > pageCount) {
      setTransactionsPage(pageCount);
    }
  }, [filteredTransactions.length, transactionsPage, transactionsPageSize]);

  const renderTransactions = () => (
    <>
      <div className='orders-toolbar'>
        <div className='orders-toolbar-left finance-transactions-toolbar-left'>
          <button
            type='button'
            className='toolbar-square-button'
            aria-label='Previous page'
            onClick={() =>
              setTransactionsPage((current) => Math.max(1, current - 1))
            }
            disabled={transactionsPage <= 1}
          >
            &lsaquo;
          </button>
          <div className='finance-transactions-page-chip'>{transactionsPage}</div>
          <button
            type='button'
            className='toolbar-square-button'
            aria-label='Next page'
            onClick={() => {
              const pageCount = Math.max(
                1,
                Math.ceil(filteredTransactions.length / transactionsPageSize),
              );
              setTransactionsPage((current) =>
                Math.min(pageCount, current + 1),
              );
            }}
            disabled={
              transactionsPage >=
              Math.max(
                1,
                Math.ceil(filteredTransactions.length / transactionsPageSize),
              )
            }
          >
            &rsaquo;
          </button>
          <button
            type='button'
            className='toolbar-filter-button toolbar-filter-toggle-button'
            aria-expanded={isTransactionsFilterOpen}
            onClick={() => setIsTransactionsFilterOpen((current) => !current)}
          >
            Filter
            {activeTransactionFiltersCount > 0 ? (
              <span className='toolbar-filter-count'>{activeTransactionFiltersCount}</span>
            ) : null}
          </button>
          <button
            type='button'
            className='toolbar-filter-button toolbar-filter-toggle-button'
            aria-expanded={isTransactionsDateFilterOpen}
            onClick={() =>
              setIsTransactionsDateFilterOpen((current) => !current)
            }
          >
            Date
            {appliedTransactionFilters.dateFrom || appliedTransactionFilters.dateTo ? (
              <span className='toolbar-filter-count'>
                {appliedTransactionFilters.dateFrom &&
                appliedTransactionFilters.dateTo
                  ? '2'
                  : '1'}
              </span>
            ) : null}
          </button>
          <div className='finance-transactions-cashbox-select'>
            <select
              value={selectedTransactionCashboxId}
              onChange={(event) => {
                setSelectedTransactionCashboxId(event.target.value);
                setTransactionsPage(1);
              }}
              aria-label='Filter transactions by cashbox'
            >
              <option value=''>All cashboxes</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section
        className={
          isTransactionsFilterOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
      >
        <button
          type='button'
          className='orders-filter-panel-close'
          aria-label='Close filters panel'
          onClick={() => setIsTransactionsFilterOpen(false)}
        >
          &times;
        </button>
        <div className='orders-filter-grid'>
          <label className='orders-filter-field'>
            <span>Type</span>
            <select
              value={draftTransactionFilters.type}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  type: event.target.value as '' | FinanceTransactionType,
                }))
              }
            >
              <option value=''>All</option>
              <option value='deposit'>Deposit</option>
              <option value='withdraw'>Withdraw</option>
              <option value='transfer'>Transfer</option>
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>Currency</span>
            <select
              value={draftTransactionFilters.currency}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  currency: event.target.value as '' | FinanceCurrency,
                }))
              }
            >
              <option value=''>All</option>
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>From cashbox</span>
            <select
              value={draftTransactionFilters.fromCashboxId}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  fromCashboxId: event.target.value,
                }))
              }
            >
              <option value=''>All</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>To cashbox</span>
            <select
              value={draftTransactionFilters.toCashboxId}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  toCashboxId: event.target.value,
                }))
              }
            >
              <option value=''>All</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>Note</span>
            <input
              type='text'
              value={draftTransactionFilters.note}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder='Order note'
            />
          </label>
          <label className='orders-filter-field'>
            <span>Sort by</span>
            <select
              value={draftTransactionFilters.sortBy}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  sortBy: event.target.value as TransactionFilters['sortBy'],
                }))
              }
            >
              <option value='date'>Date</option>
              <option value='type'>Type</option>
              <option value='amount'>Amount</option>
              <option value='currency'>Currency</option>
              <option value='from'>From cashbox</option>
              <option value='to'>To cashbox</option>
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>Direction</span>
            <select
              value={draftTransactionFilters.sortDirection}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  sortDirection: event.target.value as TransactionFilters['sortDirection'],
                }))
              }
            >
              <option value='desc'>Descending</option>
              <option value='asc'>Ascending</option>
            </select>
          </label>
        </div>
        <div className='orders-filter-actions'>
          <button
            type='button'
            className='toolbar-filter-button orders-filter-apply'
            onClick={() => {
              setAppliedTransactionFilters({
                ...draftTransactionFilters,
                note: draftTransactionFilters.note.trim(),
              });
              setTransactionsPage(1);
            }}
          >
            Apply
          </button>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => {
              setDraftTransactionFilters(initialTransactionFilters);
              setAppliedTransactionFilters(initialTransactionFilters);
              setTransactionsPage(1);
            }}
          >
            Clear
          </button>
        </div>
      </section>
      <section
        className={
          isTransactionsDateFilterOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
      >
        <button
          type='button'
          className='orders-filter-panel-close'
          aria-label='Close date filters panel'
          onClick={() => setIsTransactionsDateFilterOpen(false)}
        >
          &times;
        </button>
        <div className='orders-filter-grid'>
          <label className='orders-filter-field'>
            <span>Date from</span>
            <input
              type='date'
              value={draftTransactionFilters.dateFrom}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </label>
          <label className='orders-filter-field'>
            <span>Date to</span>
            <input
              type='date'
              value={draftTransactionFilters.dateTo}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className='orders-filter-actions'>
          <button
            type='button'
            className='toolbar-filter-button orders-filter-apply'
            onClick={() => {
              setAppliedTransactionFilters((current) => ({
                ...current,
                dateFrom: draftTransactionFilters.dateFrom,
                dateTo: draftTransactionFilters.dateTo,
              }));
              setTransactionsPage(1);
            }}
          >
            Apply
          </button>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => {
              setDraftTransactionFilters((current) => ({
                ...current,
                dateFrom: '',
                dateTo: '',
              }));
              setAppliedTransactionFilters((current) => ({
                ...current,
                dateFrom: '',
                dateTo: '',
              }));
              setTransactionsPage(1);
            }}
          >
            Clear
          </button>
        </div>
      </section>

      <div className='finance-table-wrap'>
        <table className='orders-table'>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Amount</th><th>Total</th><th>From</th><th>To</th><th>Note</th></tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr><td colSpan={7} className='orders-empty'>Transactions not found.</td></tr>
            ) : (
                            paginatedTransactions.map((transaction, index) => {
                const currentDay = transaction.transactionDate.slice(0, 10);
                const previousDay = paginatedTransactions[index - 1]?.transactionDate.slice(0, 10);
                const isNewDay = index === 0 || currentDay !== previousDay;
                return (
                  <Fragment key={transaction.id}>
                    {isNewDay ? (
                      <tr className='finance-day-separator-row'>
                        <td colSpan={7} className='finance-day-separator-cell'>
                          {formatTransactionDayLabel(transaction.transactionDate)}
                        </td>
                      </tr>
                    ) : null}
                    <tr>
                      <td>{formatDateDdMmYyyy(transaction.transactionDate)}</td>
                      <td className={`finance-transaction-type finance-transaction-type-${transaction.type}`}>
                        {transactionLabels[transaction.type]}
                      </td>
                      <td>{formatMoney(transaction.amount, transaction.currency)}</td>
                      <td>
                        {balanceAfterByTransactionId[transaction.id] === null ||
                        balanceAfterByTransactionId[transaction.id] === undefined
                          ? '-'
                          : formatMoney(
                              balanceAfterByTransactionId[
                                transaction.id
                              ] as number,
                              transaction.currency,
                            )}
                      </td>
                      <td>{transaction.fromCashbox?.name ?? '-'}</td>
                      <td>{transaction.toCashbox?.name ?? '-'}</td>
                      <td>
                        {(() => {
                          const normalizedNote = transaction.note.trim();
                          const parsedOrderNumber =
                            normalizedNote.match(/order\s+([A-Za-z0-9-]+)/i)?.[1] ?? '';
                          const parsedOrderNumberNormalized = parsedOrderNumber.toLowerCase();
                          const matchedSale = sales.find(
                            (sale) =>
                              (sale.recordNumber ?? '').toLowerCase() === parsedOrderNumberNormalized ||
                              sale.id.toLowerCase() === parsedOrderNumberNormalized,
                          );
                          if (matchedSale) {
                            return (
                              <button
                                type='button'
                                className='catalog-name-button'
                                onClick={() =>
                                  onOpenSaleCard({ id: matchedSale.id, kind: matchedSale.kind })
                                }
                              >
                                {transaction.note}
                              </button>
                            );
                          }
                          const matchedOrder = supplierOrders.find(
                            (order) =>
                              order.number === parsedOrderNumber ||
                              order.orderBaseId === parsedOrderNumber,
                          );
                          if (!matchedOrder) return transaction.note || '-';
                          return (
                            <button
                              type='button'
                              className='catalog-name-button'
                              onClick={() => setSelectedSupplierOrder(matchedOrder)}
                            >
                              {transaction.note}
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  </Fragment>
                );
              })            )}
          </tbody>
        </table>
      </div>
      <PaginationPanel
        totalItems={filteredTransactions.length}
        page={transactionsPage}
        pageSize={transactionsPageSize}
        onPageChange={setTransactionsPage}
        onPageSizeChange={(nextPageSize) => {
          setTransactionsPageSize(nextPageSize);
          setTransactionsPage(1);
        }}
      />
    </>
  );

  const renderSupplierOrdersQueue = () => (
    <div className='finance-table-wrap'>
      <table className='orders-table'>
        <thead>
          <tr><th>Number</th><th>Date</th><th>Supplier</th><th>Amount</th><th>Payment</th></tr>
        </thead>
        <tbody>
          {supplierOrdersQueue.length === 0 ? (
            <tr><td colSpan={5} className='orders-empty'>No orders are waiting for payment.</td></tr>
          ) : (
            supplierOrdersQueue.map((order) => {
              const cashboxId = transactionForm.fromCashboxId || firstCashboxId;
              return (
                <tr key={order.id}>
                  <td>{order.number || order.orderBaseId}</td>
                  <td>{formatDateTime(order.deliveryDate || order.createdAt)}</td>
                  <td>{order.supplierName}</td>
                  <td>{formatMoney(order.total, 'UAH')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={cashboxId} onChange={(event) => setTransactionForm((current) => ({ ...current, fromCashboxId: event.target.value }))}>
                        {cashboxes.map((cashbox) => (
                          <option key={cashbox.id} value={cashbox.id}>{cashbox.name}</option>
                        ))}
                      </select>
                      <button
                        type='button'
                        className='primary-button'
                        disabled={isSaving || !cashboxId}
                        onClick={async () => {
                          if (!cashboxId) return;
                          setIsSaving(true);
                          try {
                            await paySupplierOrder(order.id, { cashboxId, note: `Payment for order ${order.number || order.orderBaseId}` });
                            onSuccess('Order has been paid.');
                            window.dispatchEvent(new Event('project-goods:finance-updated'));
                            await refreshFinance();
                          } catch (error) {
                            onError(error instanceof Error ? error.message : 'Failed to pay order.');
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                      >
                        Pay
                      </button>
                      <button
                        type='button'
                        className='secondary-button'
                        disabled={isSaving}
                        onClick={() => setWithoutPaymentOrder(order)}
                      >
                        Issue without payment
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const renderReports = () => (
    <div className='finance-report-grid'>
      <article className='analytics-summary-card'><span className='metric-label'>Total cashboxes</span><strong>{report?.cashboxCount ?? cashboxes.length}</strong></article>
      <article className='analytics-summary-card'><span className='metric-label'>Balance UAH</span><strong>{formatMoney(report?.totals.UAH ?? totals.UAH, 'UAH')}</strong></article>
      <article className='analytics-summary-card'><span className='metric-label'>Balance USD</span><strong>{formatMoney(report?.totals.USD ?? totals.USD, 'USD')}</strong></article>
      <article className='analytics-summary-card'><span className='metric-label'>Operations today</span><strong>{report?.todayTransactionCount ?? 0}</strong></article>
      <article className='finance-wide-report'><h3>Today turnover</h3><p>{formatMoney(report?.todayTurnover.UAH ?? 0, 'UAH')}</p><p>{formatMoney(report?.todayTurnover.USD ?? 0, 'USD')}</p></article>
    </div>
  );

  return (
    <section className='orders-page finance-page'>
      <div className='orders-tabs' role='tablist' aria-label='Accounting sections'>
        {[
          ['cashboxes', 'Cashboxes'],
          ['transactions', 'Transactions'],
          ['orders', 'Orders'],
          ['reports', 'Reports'],
        ].map(([key, label]) => (
          <button key={key} type='button' className={activeTab === key ? 'orders-tab orders-tab-active' : 'orders-tab'} onClick={() => setActiveTab(key as AccountingTab)}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className='empty-state'>Loading finance data...</p>
      ) : activeTab === 'transactions' ? (
        renderTransactions()
      ) : activeTab === 'orders' ? (
        renderSupplierOrdersQueue()
      ) : activeTab === 'reports' ? (
        renderReports()
      ) : (
        renderCashboxes()
      )}
      <SupplierOrderModal
        isOpen={Boolean(selectedSupplierOrder)}
        suppliers={[]}
        editingOrder={selectedSupplierOrder}
        forceReadOnly
        onClose={() => setSelectedSupplierOrder(null)}
        onCreateSupplier={async () => false}
        onSubmit={async () => undefined}
        onSuccess={onSuccess}
        onError={onError}
      />
      {withoutPaymentOrder ? (
        <div
          className='modal-backdrop'
          role='presentation'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setWithoutPaymentOrder(null);
            }
          }}
        >
          <div className='catalog-edit-modal finance-without-payment-modal' role='dialog' aria-modal='true' aria-labelledby='issue-without-payment-title'>
            <header className='catalog-edit-header'>
              <h2 id='issue-without-payment-title'>Confirm issue without payment</h2>
              <button type='button' className='ghost-button' onClick={() => setWithoutPaymentOrder(null)}>
                &times;
              </button>
            </header>
            <div className='catalog-edit-body'>
              <p>
                Order <strong>{withoutPaymentOrder.number || withoutPaymentOrder.orderBaseId}</strong> will be
                marked as <strong>issued without payment</strong>.
              </p>
              <p>No finance transaction will be created. Continue?</p>
            </div>
            <footer className='catalog-edit-footer'>
              <button type='button' className='secondary-button' onClick={() => setWithoutPaymentOrder(null)}>
                Cancel
              </button>
              <button
                type='button'
                className='primary-button'
                disabled={isSaving}
                onClick={async () => {
                  if (!withoutPaymentOrder) return;
                  setIsSaving(true);
                  try {
                    await issueSupplierOrderWithoutPayment(withoutPaymentOrder.id);
                    onSuccess('Order issued without payment.');
                    window.dispatchEvent(new Event('project-goods:finance-updated'));
                    setWithoutPaymentOrder(null);
                    await refreshFinance();
                  } catch (error) {
                    onError(error instanceof Error ? error.message : 'Failed to issue order without payment.');
                  } finally {
                    setIsSaving(false);
                  }
                }}
              >
                Confirm
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
};
