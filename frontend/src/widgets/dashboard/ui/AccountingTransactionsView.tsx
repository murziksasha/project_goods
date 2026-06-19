import { Fragment, type Dispatch, type SetStateAction } from 'react';
import type {
  Cashbox,
  FinanceTransaction,
  FinanceTransactionType,
} from '../../../entities/finance/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import {
  CompactPaginationPanel,
  PaginationPanel,
} from '../../../shared/ui/PaginationPanel';
import {
  formatDateDdMmYyyy,
  formatMoney,
  formatTransactionDayLabel,
  initialTransactionFilters,
  parseTransactionOrderToken,
  transactionLabels,
  type TransactionFilters,
} from '../model/accounting';
import { getOrderLink } from './create-order-card-shared';

type AccountingTransactionsViewProps = {
  activeFiltersCount: number;
  allCurrencyCodes: string[];
  appliedFilters: TransactionFilters;
  balanceAfterByTransactionId: Record<string, number | null>;
  cashboxes: Cashbox[];
  draftFilters: TransactionFilters;
  filteredTransactions: FinanceTransaction[];
  isDateFilterOpen: boolean;
  isFilterOpen: boolean;
  page: number;
  pageSize: number;
  paginatedTransactions: FinanceTransaction[];
  sales: Sale[];
  selectedCashboxId: string;
  supplierOrders: SupplierOrder[];
  canCancelTransferTransaction: (transaction: FinanceTransaction) => boolean;
  onDateFilterOpenChange: (value: SetStateAction<boolean>) => void;
  onFilterOpenChange: (value: SetStateAction<boolean>) => void;
  onOpenSaleCard: (sale: { id: string; kind: 'repair' | 'sale' }) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSelectedCashboxIdChange: (cashboxId: string) => void;
  onSelectedSupplierOrderChange: (order: SupplierOrder) => void;
  onSetAppliedFilters: Dispatch<SetStateAction<TransactionFilters>>;
  onSetDraftFilters: Dispatch<SetStateAction<TransactionFilters>>;
  onSetTransferToCancel: (transaction: FinanceTransaction) => void;
  onEditTransactionNote?: (transaction: FinanceTransaction) => void;
};

export const AccountingTransactionsView = ({
  activeFiltersCount,
  allCurrencyCodes,
  appliedFilters,
  balanceAfterByTransactionId,
  cashboxes,
  draftFilters,
  filteredTransactions,
  isDateFilterOpen,
  isFilterOpen,
  page,
  pageSize,
  paginatedTransactions,
  sales,
  selectedCashboxId,
  supplierOrders,
  canCancelTransferTransaction,
  onDateFilterOpenChange,
  onFilterOpenChange,
  onOpenSaleCard: _onOpenSaleCard,
  onPageChange,
  onPageSizeChange,
  onSelectedCashboxIdChange,
  onSelectedSupplierOrderChange,
  onSetAppliedFilters,
  onSetDraftFilters,
  onSetTransferToCancel,
  onEditTransactionNote,
}: AccountingTransactionsViewProps) => (
  <>
    <div className='orders-toolbar'>
      <div className='orders-toolbar-left finance-transactions-toolbar-left'>
        <CompactPaginationPanel
          totalItems={filteredTransactions.length}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
        <button
          type='button'
          className='toolbar-filter-button toolbar-filter-toggle-button'
          aria-expanded={isFilterOpen}
          onClick={() => onFilterOpenChange((current) => !current)}
        >
          Filter
          {activeFiltersCount > 0 ? (
            <span className='toolbar-filter-count'>{activeFiltersCount}</span>
          ) : null}
        </button>
        <button
          type='button'
          className='toolbar-filter-button toolbar-filter-toggle-button'
          aria-expanded={isDateFilterOpen}
          onClick={() => onDateFilterOpenChange((current) => !current)}
        >
          Date
          {appliedFilters.dateFrom || appliedFilters.dateTo ? (
            <span className='toolbar-filter-count'>
              {appliedFilters.dateFrom && appliedFilters.dateTo ? '2' : '1'}
            </span>
          ) : null}
        </button>
        <div className='finance-transactions-cashbox-select'>
          <select
            value={selectedCashboxId}
            onChange={(event) => {
              onSelectedCashboxIdChange(event.target.value);
              onPageChange(1);
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
        isFilterOpen
          ? 'orders-filter-panel orders-filter-panel-open'
          : 'orders-filter-panel'
      }
    >
      <button
        type='button'
        className='orders-filter-panel-close'
        aria-label='Close filters panel'
        onClick={() => onFilterOpenChange(false)}
      >
        &times;
      </button>
      <div className='orders-filter-grid'>
        <label className='orders-filter-field'>
          <span>Type</span>
          <select
            value={draftFilters.type}
            onChange={(event) =>
              onSetDraftFilters((current) => ({
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
            value={draftFilters.currency}
            onChange={(event) =>
              onSetDraftFilters((current) => ({
                ...current,
                currency: event.target.value,
              }))
            }
          >
            <option value=''>All</option>
            {allCurrencyCodes.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>From cashbox</span>
          <select
            value={draftFilters.fromCashboxId}
            onChange={(event) =>
              onSetDraftFilters((current) => ({
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
            value={draftFilters.toCashboxId}
            onChange={(event) =>
              onSetDraftFilters((current) => ({
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
            value={draftFilters.note}
            onChange={(event) =>
              onSetDraftFilters((current) => ({
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
            value={draftFilters.sortBy}
            onChange={(event) =>
              onSetDraftFilters((current) => ({
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
            value={draftFilters.sortDirection}
            onChange={(event) =>
              onSetDraftFilters((current) => ({
                ...current,
                sortDirection: event.target
                  .value as TransactionFilters['sortDirection'],
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
            onSetAppliedFilters({
              ...draftFilters,
              note: draftFilters.note.trim(),
            });
            onPageChange(1);
          }}
        >
          Apply
        </button>
        <button
          type='button'
          className='toolbar-filter-button'
          onClick={() => {
            onSetDraftFilters(initialTransactionFilters);
            onSetAppliedFilters(initialTransactionFilters);
            onPageChange(1);
          }}
        >
          Clear
        </button>
      </div>
    </section>
    <section
      className={
        isDateFilterOpen
          ? 'orders-filter-panel orders-filter-panel-open'
          : 'orders-filter-panel'
      }
    >
      <button
        type='button'
        className='orders-filter-panel-close'
        aria-label='Close date filters panel'
        onClick={() => onDateFilterOpenChange(false)}
      >
        &times;
      </button>
      <div className='orders-filter-grid'>
        <label className='orders-filter-field'>
          <span>Date from</span>
          <input
            type='date'
            value={draftFilters.dateFrom}
            onChange={(event) =>
              onSetDraftFilters((current) => ({
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
            value={draftFilters.dateTo}
            onChange={(event) =>
              onSetDraftFilters((current) => ({
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
            onSetAppliedFilters((current) => ({
              ...current,
              dateFrom: draftFilters.dateFrom,
              dateTo: draftFilters.dateTo,
            }));
            onPageChange(1);
          }}
        >
          Apply
        </button>
        <button
          type='button'
          className='toolbar-filter-button'
          onClick={() => {
            onSetDraftFilters((current) => ({
              ...current,
              dateFrom: '',
              dateTo: '',
            }));
            onSetAppliedFilters((current) => ({
              ...current,
              dateFrom: '',
              dateTo: '',
            }));
            onPageChange(1);
          }}
        >
          Clear
        </button>
      </div>
    </section>

    <div className='finance-table-wrap finance-card-table-wrap'>
      <table className='orders-table finance-transactions-table'>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Total</th>
            <th>From</th>
            <th>To</th>
            <th>Note</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredTransactions.length === 0 ? (
            <tr>
              <td colSpan={8} className='orders-empty'>
                Transactions not found.
              </td>
            </tr>
          ) : (
            paginatedTransactions.map((transaction, index) => {
              const currentDay = transaction.transactionDate.slice(0, 10);
              const previousDay = paginatedTransactions[
                index - 1
              ]?.transactionDate.slice(0, 10);
              const isNewDay = index === 0 || currentDay !== previousDay;
              const isCancelled =
                (transaction.status ?? 'active') === 'cancelled';
              const isCancellation =
                transaction.isCancellation ||
                Boolean(transaction.cancelsTransactionId);
              const canCancelTransfer =
                canCancelTransferTransaction(transaction);
              return (
                <Fragment key={transaction.id}>
                  {isNewDay ? (
                    <tr className='finance-day-separator-row'>
                      <td colSpan={8} className='finance-day-separator-cell'>
                        {formatTransactionDayLabel(transaction.transactionDate)}
                      </td>
                    </tr>
                  ) : null}
                  <tr
                    className={
                      isCancelled ? 'finance-transaction-row-cancelled' : undefined
                    }
                  >
                    <td data-label='Date'>{formatDateDdMmYyyy(transaction.transactionDate)}</td>
                    <td
                      className={`finance-transaction-type finance-transaction-type-${transaction.type}`}
                      data-label='Type'
                    >
                      {transactionLabels[transaction.type]}
                      {isCancelled ? (
                        <span className='finance-transaction-badge finance-transaction-badge-cancelled'>
                          Cancelled
                        </span>
                      ) : null}
                      {isCancellation ? (
                        <span className='finance-transaction-badge finance-transaction-badge-cancellation'>
                          Cancellation
                        </span>
                      ) : null}
                    </td>
                    <td data-label='Amount'>{formatMoney(transaction.amount, transaction.currency)}</td>
                    <td data-label='Total'>
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
                    <td data-label='From'>{transaction.fromCashbox?.name ?? '-'}</td>
                    <td data-label='To'>{transaction.toCashbox?.name ?? '-'}</td>
                    <td data-label='Note'>
                      {(() => {
                        const token = parseTransactionOrderToken(transaction.note);
                        if (token) {
                          const normalizedToken = token.toLowerCase();
                          const matchedSale = sales.find(
                            (sale) =>
                              (sale.recordNumber ?? '').toLowerCase() === normalizedToken ||
                              sale.id.toLowerCase() === normalizedToken,
                          );
                          if (matchedSale) {
                            return (
                              <button
                                type='button'
                                className='catalog-name-button'
                                onClick={() => {
                                  const url = getOrderLink(matchedSale.id, matchedSale.kind);
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                              >
                                {transaction.note}
                              </button>
                            );
                          }
                          const matchedOrder = supplierOrders.find(
                            (order) =>
                              order.number === token ||
                              order.orderBaseId === token,
                          );
                          if (matchedOrder) {
                            return (
                              <button
                                type='button'
                                className='catalog-name-button'
                                onClick={() =>
                                  onSelectedSupplierOrderChange(matchedOrder)
                                }
                              >
                                {transaction.note}
                              </button>
                            );
                          }
                        }
                        const hasNote = transaction.note && transaction.note.trim().length > 0;
                        if (hasNote) {
                          return (
                            <button
                              type='button'
                              className='catalog-name-button'
                              title='Edit note'
                              onClick={() => onEditTransactionNote?.(transaction)}
                            >
                              {transaction.note}
                            </button>
                          );
                        }
                        return '-';
                      })()}
                    </td>
                    <td className='finance-transaction-action-cell' data-label='Action'>
                      {canCancelTransfer ? (
                        <button
                          type='button'
                          className='toolbar-filter-button finance-transaction-cancel-button'
                          onClick={() => onSetTransferToCancel(transaction)}
                        >
                          Cancel transfer
                        </button>
                      ) : null}
                    </td>
                  </tr>
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
    <PaginationPanel
      totalItems={filteredTransactions.length}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  </>
);
