import type { Dispatch, SetStateAction } from 'react';
import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceCurrency,
  FinanceTransactionType,
} from '../../../entities/finance/model/types';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import {
  formatMoney,
  transactionLabels,
  type CashboxCurrencyRow,
} from '../model/accounting';

type AccountingCashboxesViewProps = {
  allowedTransactionCurrencies: string[];
  canCreateDeposit: boolean;
  canCreateTransfer: boolean;
  canCreateWithdraw: boolean;
  canManageCashboxes: boolean;
  cashboxes: Cashbox[];
  cashboxCurrencyRows: (cashbox: Cashbox) => CashboxCurrencyRow[];
  draggedCashboxId: string | null;
  isSaving: boolean;
  newCashboxName: string;
  permittedTransactionTypes: FinanceTransactionType[];
  totals: Record<string, number>;
  transactionForm: CreateFinanceTransactionPayload;
  onCreateCashbox: () => void;
  onCreateTransaction: () => void;
  onNewCashboxNameChange: (value: string) => void;
  onOpenCashboxTransactions: (cashbox: Cashbox) => void;
  onSetCashboxes: Dispatch<SetStateAction<Cashbox[]>>;
  onSetDraggedCashboxId: (cashboxId: string | null) => void;
  onStartTransaction: (type: FinanceTransactionType, cashbox: Cashbox) => void;
  onTransactionFormChange: (
    updater: SetStateAction<CreateFinanceTransactionPayload>,
  ) => void;
  onTransactionTypeChange: (type: FinanceTransactionType) => void;
};

export const AccountingCashboxesView = ({
  allowedTransactionCurrencies,
  canCreateDeposit,
  canCreateTransfer,
  canCreateWithdraw,
  canManageCashboxes,
  cashboxes,
  cashboxCurrencyRows,
  draggedCashboxId,
  isSaving,
  newCashboxName,
  permittedTransactionTypes,
  totals,
  transactionForm,
  onCreateCashbox,
  onCreateTransaction,
  onNewCashboxNameChange,
  onOpenCashboxTransactions,
  onSetCashboxes,
  onSetDraggedCashboxId,
  onStartTransaction,
  onTransactionFormChange,
  onTransactionTypeChange,
}: AccountingCashboxesViewProps) => (
  <>
    <div className='finance-toolbar'>
      <div className='finance-total-strip'>
        {Object.entries(totals)
          .filter(([currency, amount]) => currency === 'UAH' || amount !== 0)
          .map(([currency, amount], index) =>
            index === 0 ? (
              <strong key={currency}>{formatMoney(amount, currency)}</strong>
            ) : (
              <span key={currency}>{formatMoney(amount, currency)}</span>
            ),
          )}
      </div>
      {canManageCashboxes ? (
        <div className='finance-add-cashbox'>
          <input
            value={newCashboxName}
            onChange={(event) => onNewCashboxNameChange(event.target.value)}
            placeholder='New cashbox'
          />
          <button
            type='button'
            className='orders-create-button'
            onClick={onCreateCashbox}
            disabled={isSaving}
          >
            Add cashbox
          </button>
        </div>
      ) : null}
    </div>

    <div className='finance-cashbox-grid'>
      {cashboxes.map((cashbox) => (
        <article
          key={cashbox.id}
          className='finance-cashbox-card'
          draggable
          onDragStart={() => onSetDraggedCashboxId(cashbox.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (!draggedCashboxId || draggedCashboxId === cashbox.id) {
              onSetDraggedCashboxId(null);
              return;
            }
            onSetCashboxes((current) => {
              const fromIndex = current.findIndex(
                (item) => item.id === draggedCashboxId,
              );
              const toIndex = current.findIndex((item) => item.id === cashbox.id);
              if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
                return current;
              }
              const next = [...current];
              const [moved] = next.splice(fromIndex, 1);
              next.splice(toIndex, 0, moved);
              return next;
            });
            onSetDraggedCashboxId(null);
          }}
          onDragEnd={() => onSetDraggedCashboxId(null)}
        >
          <div className='finance-cashbox-heading'>
            <h3>{cashbox.name}</h3>
            {cashbox.isDefault ? <span>Default</span> : null}
          </div>
          <div className='finance-cashbox-balances'>
            {cashboxCurrencyRows(cashbox).length === 0 ? (
              <span className='finance-cashbox-balance-row finance-cashbox-balance-row-inactive'>
                <strong>No active currency balances</strong>
              </span>
            ) : (
              cashboxCurrencyRows(cashbox).map(
                ({ currency, balance, canAccept }) => (
                  <div
                    key={`${cashbox.id}-${currency}`}
                    className={
                      canAccept
                        ? 'finance-cashbox-balance-row'
                        : 'finance-cashbox-balance-row finance-cashbox-balance-row-inactive'
                    }
                  >
                    <strong
                      className={
                        currency === 'UAH'
                          ? 'finance-cashbox-balance-value finance-cashbox-balance-value-uah'
                          : 'finance-cashbox-balance-value'
                      }
                    >
                      {currency === 'UAH' ? (
                        <>
                          <span className='finance-cashbox-balance-amount'>
                            {new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(balance)}
                          </span>
                          <span className='finance-cashbox-balance-currency-code'>
                            UAH
                          </span>
                        </>
                      ) : (
                        formatMoney(balance, currency)
                      )}
                    </strong>
                    {canAccept ? null : (
                      <span title='Currency is inactive for receiving. You can only withdraw existing balance.'>
                        Withdraw only
                      </span>
                    )}
                  </div>
                ),
              )
            )}
          </div>
          <div className='finance-cashbox-actions'>
            {canCreateWithdraw ? (
              <button
                type='button'
                onClick={() => onStartTransaction('withdraw', cashbox)}
              >
                Withdraw
              </button>
            ) : null}
            {canCreateDeposit ? (
              <button
                type='button'
                onClick={() => onStartTransaction('deposit', cashbox)}
              >
                Deposit
              </button>
            ) : null}
            {canCreateTransfer ? (
              <button
                type='button'
                onClick={() => onStartTransaction('transfer', cashbox)}
              >
                Transfer
              </button>
            ) : null}
            <button type='button' onClick={() => onOpenCashboxTransactions(cashbox)}>
              Transactions
            </button>
          </div>
        </article>
      ))}
    </div>

    {permittedTransactionTypes.length > 0 ? (
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
            <select
              value={transactionForm.type}
              onChange={(event) =>
                onTransactionTypeChange(
                  event.target.value as FinanceTransactionType,
                )
              }
            >
              {canCreateDeposit ? <option value='deposit'>Deposit</option> : null}
              {canCreateWithdraw ? (
                <option value='withdraw'>Withdraw</option>
              ) : null}
              {canCreateTransfer ? (
                <option value='transfer'>Transfer</option>
              ) : null}
            </select>
          </label>
          <label className='field'>
            <span>Amount</span>
            <NumberStepper
              min={0}
              step={0.01}
              precision={2}
              value={transactionForm.amount}
              onChange={(value) =>
                onTransactionFormChange((current) => ({
                  ...current,
                  amount: value,
                }))
              }
            />
          </label>
          <label className='field'>
            <span>Currency</span>
            <select
              value={
                allowedTransactionCurrencies.includes(transactionForm.currency)
                  ? transactionForm.currency
                  : ''
              }
              onChange={(event) =>
                onTransactionFormChange((current) => ({
                  ...current,
                  currency: event.target.value as FinanceCurrency,
                }))
              }
              disabled={allowedTransactionCurrencies.length === 0}
            >
              {allowedTransactionCurrencies.length === 0 ? (
                <option value=''>No available currencies</option>
              ) : (
                allowedTransactionCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className='field'>
            <span>From cashbox</span>
            <select
              value={transactionForm.fromCashboxId}
              disabled={transactionForm.type === 'deposit'}
              onChange={(event) =>
                onTransactionFormChange((current) => ({
                  ...current,
                  fromCashboxId: event.target.value,
                }))
              }
            >
              <option value=''>-</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>To cashbox</span>
            <select
              value={transactionForm.toCashboxId}
              disabled={transactionForm.type === 'withdraw'}
              onChange={(event) =>
                onTransactionFormChange((current) => ({
                  ...current,
                  toCashboxId: event.target.value,
                }))
              }
            >
              <option value=''>-</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>Comment</span>
            <input
              value={transactionForm.note}
              onChange={(event) =>
                onTransactionFormChange((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <button
          type='button'
          className='primary-button'
          onClick={onCreateTransaction}
          disabled={
            isSaving ||
            !transactionForm.amount ||
            allowedTransactionCurrencies.length === 0
          }
        >
          {isSaving ? 'Saving...' : 'Save operation'}
        </button>
      </section>
    ) : null}
  </>
);
