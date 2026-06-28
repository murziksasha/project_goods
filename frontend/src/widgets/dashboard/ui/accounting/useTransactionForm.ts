import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceTransactionType,
} from '../../../../entities/finance/model/types';
import i18n from '../../../../shared/i18n/config';
import { parseDecimal } from '../../../../shared/lib/decimal';
import { createRuntimeId } from '../../../../shared/lib/runtime-id';
import {
  canPerformTransferBetweenCashboxes,
  getAllowedAccountingTransactionCurrencies,
  initialTransactionForm,
  resolvePreferredTargetCashboxId,
  type TransactionTargetMemory,
} from '../../model/accounting';

type UseTransactionFormOptions = {
  cashboxes: Cashbox[];
  allCurrencyCodes: string[];
  getCurrencyBalance: (cashbox: Cashbox, currencyCode: string) => number;
  isCashboxCurrencyActive: (cashboxId: string, currencyCode: string) => boolean;
  isGlobalCurrencyActive: (currencyCode: string) => boolean;
  lastTargetCashboxByType: TransactionTargetMemory;
  setLastTargetCashboxByType: Dispatch<SetStateAction<TransactionTargetMemory>>;
  permittedTransactionTypes: FinanceTransactionType[];
  runFinanceAction: (
    action: () => Promise<unknown>,
    successMessage: string,
    options?: {
      afterSuccess?: (result: unknown) => void | Promise<void>;
      errorFallback?: string;
      skipRefresh?: boolean;
    },
  ) => Promise<unknown>;
  createFinanceTransaction: (payload: CreateFinanceTransactionPayload & { idempotencyKey?: string }) => Promise<unknown>;
  onError: (message: string) => void;
  isSaving?: boolean;
};

export const useTransactionForm = ({
  cashboxes,
  allCurrencyCodes,
  getCurrencyBalance,
  isCashboxCurrencyActive,
  isGlobalCurrencyActive,
  lastTargetCashboxByType,
  setLastTargetCashboxByType,
  permittedTransactionTypes,
  runFinanceAction,
  createFinanceTransaction,
  onError,
  isSaving = false,
}: UseTransactionFormOptions) => {
  const [transactionForm, setTransactionForm] =
    useState<CreateFinanceTransactionPayload>(initialTransactionForm);

  const firstCashboxId = cashboxes[0]?.id ?? '';
  const secondCashboxId =
    cashboxes.find((cashbox) => cashbox.id !== firstCashboxId)?.id ?? '';

  const getAllowedTransactionCurrencies = useCallback(
    (type: FinanceTransactionType, fromCashboxId?: string, toCashboxId?: string) =>
      getAllowedAccountingTransactionCurrencies({
        allCurrencyCodes,
        cashboxes,
        fromCashboxId,
        getCurrencyBalance,
        isCashboxCurrencyActive,
        isGlobalCurrencyActive,
        toCashboxId,
        type,
      }),
    [
      allCurrencyCodes,
      cashboxes,
      getCurrencyBalance,
      isCashboxCurrencyActive,
      isGlobalCurrencyActive,
    ],
  );

  const allowedTransactionCurrencies = useMemo(
    () =>
      getAllowedTransactionCurrencies(
        transactionForm.type,
        transactionForm.fromCashboxId,
        transactionForm.toCashboxId,
      ),
    [
      getAllowedTransactionCurrencies,
      transactionForm.fromCashboxId,
      transactionForm.toCashboxId,
      transactionForm.type,
    ],
  );

  useEffect(() => {
    if (allowedTransactionCurrencies.includes(transactionForm.currency)) return;
    const nextCurrency = allowedTransactionCurrencies[0];
    if (!nextCurrency) return;
    setTransactionForm((current) => ({ ...current, currency: nextCurrency }));
  }, [allowedTransactionCurrencies, transactionForm.currency]);

  const handleTransactionTypeChange = (nextType: FinanceTransactionType) => {
    if (!permittedTransactionTypes.includes(nextType)) return;
    setTransactionForm((current) => {
      const nextFromCashboxId =
        nextType === 'deposit' ? '' : current.fromCashboxId || firstCashboxId;
      const fallbackToCashboxId =
        nextType === 'deposit'
          ? current.toCashboxId || firstCashboxId
          : secondCashboxId;
      const nextToCashboxId = resolvePreferredTargetCashboxId({
        type: nextType,
        fromCashboxId: nextFromCashboxId,
        fallbackCashboxId: fallbackToCashboxId,
        cashboxes,
        lastTargetCashboxByType,
      });
      return {
        ...current,
        type: nextType,
        fromCashboxId: nextFromCashboxId,
        toCashboxId: nextToCashboxId,
      };
    });
  };

  const startForCashbox = (type: FinanceTransactionType, cashbox: Cashbox) => {
    if (!permittedTransactionTypes.includes(type)) {
      onError(i18n.t('accounting.messages.errors.noPermissionFinanceOperation'));
      return;
    }
    const nextFromCashboxId =
      type === 'withdraw' || type === 'transfer' ? cashbox.id : '';
    const fallbackToCashboxId = type === 'deposit' ? cashbox.id : secondCashboxId;
    const nextToCashboxId = resolvePreferredTargetCashboxId({
      type,
      fromCashboxId: nextFromCashboxId,
      fallbackCashboxId: fallbackToCashboxId,
      cashboxes,
      lastTargetCashboxByType,
      preferFallback: type === 'deposit',
    });
    const availableCurrencies = getAllowedTransactionCurrencies(
      type,
      nextFromCashboxId,
      nextToCashboxId,
    );
    setTransactionForm({
      ...initialTransactionForm,
      type,
      fromCashboxId: nextFromCashboxId,
      toCashboxId: nextToCashboxId,
      currency: availableCurrencies[0] ?? initialTransactionForm.currency,
    });
  };

  const handleCreateTransaction = async () => {
    if (isSaving) return;
    const { type, amount, currency, fromCashboxId, toCashboxId } = transactionForm;
    if (!permittedTransactionTypes.includes(type)) {
      onError(i18n.t('accounting.messages.errors.noPermissionFinanceOperation'));
      return;
    }
    if (
      type === 'transfer' &&
      !canPerformTransferBetweenCashboxes(fromCashboxId, toCashboxId)
    ) {
      onError(i18n.t('accounting.messages.errors.transferCashboxesMustDiffer'));
      return;
    }
    const normalizedAmount = parseDecimal(amount);
    if (!allowedTransactionCurrencies.includes(currency)) {
      onError(i18n.t('accounting.messages.errors.currencyNotAvailable'));
      return;
    }
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      onError(i18n.t('accounting.messages.errors.amountMustBePositive'));
      return;
    }

    const payload = {
      ...transactionForm,
      amount: String(normalizedAmount),
      idempotencyKey: createRuntimeId(),
    };

    await runFinanceAction(
      () => createFinanceTransaction(payload),
      i18n.t('accounting.messages.success.financeTransactionSaved'),
      {
        afterSuccess: () => {
          if (
            (type === 'deposit' || type === 'transfer') &&
            toCashboxId
          ) {
            setLastTargetCashboxByType((current) => ({
              ...current,
              [type]: toCashboxId,
            }));
          }
          const nextInitialType: FinanceTransactionType = 'deposit';
          const nextToCashboxId = resolvePreferredTargetCashboxId({
            type: nextInitialType,
            fromCashboxId: '',
            fallbackCashboxId: firstCashboxId,
            cashboxes,
            lastTargetCashboxByType,
          });
          setTransactionForm({
            ...initialTransactionForm,
            type: permittedTransactionTypes[0] ?? 'deposit',
            toCashboxId: nextToCashboxId,
          });
        },
        skipRefresh: true,
        errorFallback: i18n.t('accounting.messages.errors.failedSaveTransaction'),
      },
    );
  };

  return {
    transactionForm,
    setTransactionForm,
    allowedTransactionCurrencies,
    handleTransactionTypeChange,
    startForCashbox,
    handleCreateTransaction,
    firstCashboxId,
    secondCashboxId,
  };
};
