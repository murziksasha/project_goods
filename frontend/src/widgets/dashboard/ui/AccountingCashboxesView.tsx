import { useTranslation } from 'react-i18next';
import type { Dispatch, SetStateAction } from 'react';
import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceCurrency,
  FinanceTransactionType,
} from '../../../entities/finance/model/types';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import {
  canPerformTransferBetweenCashboxes,
  formatMoney,
  reorderCashboxes,
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
}: AccountingCashboxesViewProps) => {
  const { t } = useTranslation();
  const transactionTypeLabel = (type: FinanceTransactionType) =>
    t(`accounting.cashboxes.${type}`);

  return (
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
              placeholder={t('accounting.cashboxes.newCashboxPlaceholder')}
            />
            <button
              type='button'
              className='orders-create-button'
              onClick={onCreateCashbox}
              disabled={isSaving}
            >
              {t('accounting.cashboxes.addCashbox')}
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
              onSetCashboxes((current) =>
                reorderCashboxes(current, draggedCashboxId, cashbox.id),
              );
              onSetDraggedCashboxId(null);
            }}
            onDragEnd={() => onSetDraggedCashboxId(null)}
          >
            <div className='finance-cashbox-heading'>
              <h3>{cashbox.name}</h3>
              {cashbox.isDefault ? (
                <span>{t('accounting.cashboxes.default')}</span>
              ) : null}
            </div>
            <div className='finance-cashbox-balances'>
              {cashboxCurrencyRows(cashbox).length === 0 ? (
                <span className='finance-cashbox-balance-row finance-cashbox-balance-row-inactive'>
                  <strong>{t('accounting.cashboxes.noActiveCurrencyBalances')}</strong>
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
                        <span title={t('accounting.cashboxes.withdrawOnlyTitle')}>
                          {t('accounting.cashboxes.withdrawOnly')}
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
                  {t('accounting.cashboxes.withdraw')}
                </button>
              ) : null}
              {canCreateDeposit ? (
                <button
                  type='button'
                  onClick={() => onStartTransaction('deposit', cashbox)}
                >
                  {t('accounting.cashboxes.deposit')}
                </button>
              ) : null}
              {canCreateTransfer ? (
                <button
                  type='button'
                  onClick={() => onStartTransaction('transfer', cashbox)}
                >
                  {t('accounting.cashboxes.transfer')}
                </button>
              ) : null}
              <button
                type='button'
                onClick={() => onOpenCashboxTransactions(cashbox)}
              >
                {t('accounting.cashboxes.transactions')}
              </button>
            </div>
          </article>
        ))}
      </div>

      {permittedTransactionTypes.length > 0 ? (
        <section className='finance-operation-panel'>
          <div className='panel-header'>
            <div>
              <p className='section-label'>{t('accounting.cashboxes.operation')}</p>
              <h2>{transactionTypeLabel(transactionForm.type)}</h2>
            </div>
          </div>
          <div className='finance-operation-grid'>
            <label className='field'>
              <span>{t('accounting.cashboxes.type')}</span>
              <select
                value={transactionForm.type}
                onChange={(event) =>
                  onTransactionTypeChange(
                    event.target.value as FinanceTransactionType,
                  )
                }
              >
                {canCreateDeposit ? (
                  <option value='deposit'>
                    {t('accounting.cashboxes.deposit')}
                  </option>
                ) : null}
                {canCreateWithdraw ? (
                  <option value='withdraw'>
                    {t('accounting.cashboxes.withdraw')}
                  </option>
                ) : null}
                {canCreateTransfer ? (
                  <option value='transfer'>
                    {t('accounting.cashboxes.transfer')}
                  </option>
                ) : null}
              </select>
            </label>
            <label className='field'>
              <span>{t('accounting.cashboxes.amount')}</span>
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
              <span>{t('accounting.cashboxes.currency')}</span>
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
                  <option value=''>
                    {t('accounting.cashboxes.noAvailableCurrencies')}
                  </option>
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
              <span>{t('accounting.cashboxes.fromCashbox')}</span>
              <select
                value={transactionForm.fromCashboxId}
                disabled={transactionForm.type === 'deposit'}
                onChange={(event) =>
                  onTransactionFormChange((current) => {
                    const newFrom = event.target.value;
                    if (current.type !== 'transfer') {
                      return { ...current, fromCashboxId: newFrom };
                    }
                    let nextTo = current.toCashboxId;
                    if (newFrom && newFrom === nextTo) {
                      nextTo = cashboxes.find((c) => c.id !== newFrom)?.id ?? '';
                    }
                    return {
                      ...current,
                      fromCashboxId: newFrom,
                      toCashboxId: nextTo,
                    };
                  })
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
              <span>{t('accounting.cashboxes.toCashbox')}</span>
              <select
                value={transactionForm.toCashboxId}
                disabled={transactionForm.type === 'withdraw'}
                onChange={(event) =>
                  onTransactionFormChange((current) => {
                    const newTo = event.target.value;
                    if (current.type !== 'transfer') {
                      return { ...current, toCashboxId: newTo };
                    }
                    let nextFrom = current.fromCashboxId;
                    if (newTo && newTo === nextFrom) {
                      nextFrom = cashboxes.find((c) => c.id !== newTo)?.id ?? '';
                    }
                    return {
                      ...current,
                      toCashboxId: newTo,
                      fromCashboxId: nextFrom,
                    };
                  })
                }
              >
                <option value=''>-</option>
                {cashboxes
                  .filter(
                    (cashbox) =>
                      !(
                        transactionForm.type === 'transfer' &&
                        cashbox.id === transactionForm.fromCashboxId
                      ),
                  )
                  .map((cashbox) => (
                    <option key={cashbox.id} value={cashbox.id}>
                      {cashbox.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className='field'>
              <span>{t('accounting.cashboxes.comment')}</span>
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
              allowedTransactionCurrencies.length === 0 ||
              (transactionForm.type === 'transfer' &&
                !canPerformTransferBetweenCashboxes(
                  transactionForm.fromCashboxId,
                  transactionForm.toCashboxId,
                ))
            }
          >
            {isSaving
              ? t('accounting.cashboxes.saving')
              : t('accounting.cashboxes.saveOperation')}
          </button>
        </section>
      ) : null}
    </>
  );
};