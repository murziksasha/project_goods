import type { SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceCurrency,
  FinanceTransactionType,
} from '../../../../entities/finance/model/types';
import { parseDecimal } from '../../../../shared/lib/decimal';
import {
  PRICE_STEPPER_PRECISION,
  PRICE_STEPPER_STEP,
} from '../../../../shared/lib/price-stepper';
import { NumberStepper } from '../../../../shared/ui/NumberStepper';
import {
  canPerformTransferBetweenCashboxes,
  formatMoney,
} from '../../model/accounting';

type AccountingOperationFormProps = {
  allowedTransactionCurrencies: string[];
  availableBalance: number | null;
  canCreateDeposit: boolean;
  canCreateTransfer: boolean;
  canCreateWithdraw: boolean;
  cashboxes: Cashbox[];
  isSaving: boolean;
  saveDisabled: boolean;
  transactionForm: CreateFinanceTransactionPayload;
  onCreateTransaction: (closeAfter: boolean) => void;
  onTransactionFormChange: (
    updater: SetStateAction<CreateFinanceTransactionPayload>,
  ) => void;
  onTransactionTypeChange: (type: FinanceTransactionType) => void;
};

export const AccountingOperationForm = ({
  allowedTransactionCurrencies,
  availableBalance,
  canCreateDeposit,
  canCreateTransfer,
  canCreateWithdraw,
  cashboxes,
  isSaving,
  saveDisabled,
  transactionForm,
  onCreateTransaction,
  onTransactionFormChange,
  onTransactionTypeChange,
}: AccountingOperationFormProps) => {
  const { t } = useTranslation();
  const showFrom = transactionForm.type !== 'deposit';
  const showTo = transactionForm.type !== 'withdraw';
  const parsedAmount = parseDecimal(transactionForm.amount);
  const insufficient =
    availableBalance !== null &&
    Number.isFinite(availableBalance) &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > availableBalance;
  const confirmDisabled =
    saveDisabled ||
    insufficient ||
    (transactionForm.type === 'transfer' &&
      !canPerformTransferBetweenCashboxes(
        transactionForm.fromCashboxId,
        transactionForm.toCashboxId,
      ));
  const confirmLabel = isSaving
    ? t('accounting.cashboxes.saving')
    : t('accounting.cashboxes.confirmOperation');
  const confirmAndCloseLabel = isSaving
    ? t('accounting.cashboxes.saving')
    : t('accounting.cashboxes.confirmAndClose');

  return (
    <>
      <div className='finance-operation-grid'>
        <label className='field'>
          <span>{t('accounting.cashboxes.type')}</span>
          <select
            value={transactionForm.type}
            onChange={(event) => {
              onTransactionTypeChange(
                event.target.value as FinanceTransactionType,
              );
            }}
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
            step={PRICE_STEPPER_STEP}
            precision={PRICE_STEPPER_PRECISION}
            value={transactionForm.amount}
            onChange={(value) => {
              onTransactionFormChange((current) => ({
                ...current,
                amount: value,
              }));
            }}
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
            onChange={(event) => {
              onTransactionFormChange((current) => ({
                ...current,
                currency: event.target.value as FinanceCurrency,
              }));
            }}
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
        {showFrom ? (
          <label className='field'>
            <span>{t('accounting.cashboxes.fromCashbox')}</span>
            <select
              value={transactionForm.fromCashboxId}
              onChange={(event) => {
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
                });
              }}
            >
              <option value=''>{t('accounting.cashboxes.emptyOption')}</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {showTo ? (
          <label className='field'>
            <span>{t('accounting.cashboxes.toCashbox')}</span>
            <select
              value={transactionForm.toCashboxId}
              onChange={(event) => {
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
                });
              }}
            >
              <option value=''>{t('accounting.cashboxes.emptyOption')}</option>
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
        ) : null}
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
      {availableBalance !== null ? (
        <p className='muted-copy'>
          {t('accounting.cashboxes.remainingBalance', {
            amount: formatMoney(availableBalance, transactionForm.currency),
          })}
        </p>
      ) : null}
      {insufficient ? (
        <p className='finance-operation-warning'>
          {t('accounting.cashboxes.insufficientBalance')}
        </p>
      ) : null}
      <div className='finance-operation-actions'>
        <button
          type='button'
          className='finance-operation-confirm-stay'
          aria-label={t('accounting.cashboxes.confirmOperation')}
          onClick={() => onCreateTransaction(false)}
          disabled={confirmDisabled}
        >
          {confirmLabel}
        </button>
        <button
          type='button'
          className='primary-button'
          aria-label={t('accounting.cashboxes.confirmAndClose')}
          onClick={() => onCreateTransaction(true)}
          disabled={confirmDisabled}
        >
          {confirmAndCloseLabel}
        </button>
      </div>
    </>
  );
};
