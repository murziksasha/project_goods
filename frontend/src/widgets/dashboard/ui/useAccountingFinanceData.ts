import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useCashboxesQuery,
  useFinanceCurrenciesQuery,
  useFinanceReportQuery,
  useFinanceTransactionsQuery,
  useSupplierOrdersForPaymentQuery,
} from '../../../entities/finance/api/financeApi';
import type { Cashbox } from '../../../entities/finance/model/types';
import { useSupplierOrdersQuery } from '../../../entities/supplier-order/api/supplierOrderApi';
import {
  accountingCashboxOrderStorageKey,
  applyCashboxOrder,
} from '../model/accounting';

type UseAccountingFinanceDataOptions = {
  onError: (message: string) => void;
};

const getLoadErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Failed to load finance data.';

export const useAccountingFinanceData = ({
  onError,
}: UseAccountingFinanceDataOptions) => {
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [isCashboxesOrderHydrated, setIsCashboxesOrderHydrated] =
    useState(false);

  const activeCashboxesQuery = useCashboxesQuery();
  const allCashboxesQuery = useCashboxesQuery({ includeArchived: true });
  const transactionsQuery = useFinanceTransactionsQuery();
  const currenciesQuery = useFinanceCurrenciesQuery({ includeArchived: true });
  const reportQuery = useFinanceReportQuery();
  const supplierOrdersQueueQuery = useSupplierOrdersForPaymentQuery();
  const supplierOrdersQuery = useSupplierOrdersQuery();

  const activeCashboxes = useMemo(
    () => activeCashboxesQuery.data ?? [],
    [activeCashboxesQuery.data],
  );
  const allCashboxes = useMemo(
    () => allCashboxesQuery.data ?? [],
    [allCashboxesQuery.data],
  );
  const transactions = useMemo(
    () => transactionsQuery.data ?? [],
    [transactionsQuery.data],
  );
  const currencies = useMemo(
    () => currenciesQuery.data ?? [],
    [currenciesQuery.data],
  );
  const supplierOrders = useMemo(
    () => supplierOrdersQuery.data ?? [],
    [supplierOrdersQuery.data],
  );
  const supplierOrdersQueue = useMemo(
    () => supplierOrdersQueueQuery.data ?? [],
    [supplierOrdersQueueQuery.data],
  );

  const refreshFinance = useCallback(async () => {
    const results = await Promise.allSettled([
      activeCashboxesQuery.refetch(),
      allCashboxesQuery.refetch(),
      transactionsQuery.refetch(),
      currenciesQuery.refetch(),
      reportQuery.refetch(),
      supplierOrdersQueueQuery.refetch(),
      supplierOrdersQuery.refetch(),
    ]);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (rejected) {
      onError(getLoadErrorMessage(rejected.reason));
    }
  }, [
    activeCashboxesQuery,
    allCashboxesQuery,
    currenciesQuery,
    onError,
    reportQuery,
    supplierOrdersQuery,
    supplierOrdersQueueQuery,
    transactionsQuery,
  ]);

  useEffect(() => {
    let orderedCashboxes = activeCashboxes;
    try {
      const storedOrder = JSON.parse(
        window.localStorage.getItem(accountingCashboxOrderStorageKey) ?? '[]',
      ) as string[];
      if (Array.isArray(storedOrder)) {
        orderedCashboxes = applyCashboxOrder(activeCashboxes, storedOrder);
      }
    } catch {
      orderedCashboxes = activeCashboxes;
    }

    setCashboxes(orderedCashboxes);
    setIsCashboxesOrderHydrated(true);
  }, [activeCashboxes]);

  useEffect(() => {
    const firstError = [
      activeCashboxesQuery.error,
      allCashboxesQuery.error,
      transactionsQuery.error,
      currenciesQuery.error,
      reportQuery.error,
      supplierOrdersQueueQuery.error,
      supplierOrdersQuery.error,
    ].find(Boolean);

    if (firstError) {
      onError(getLoadErrorMessage(firstError));
    }
  }, [
    activeCashboxesQuery.error,
    allCashboxesQuery.error,
    currenciesQuery.error,
    onError,
    reportQuery.error,
    supplierOrdersQuery.error,
    supplierOrdersQueueQuery.error,
    transactionsQuery.error,
  ]);

  useEffect(() => {
    const refreshOnOrderPayment = () => {
      void refreshFinance();
    };

    window.addEventListener(
      'project-goods:finance-updated',
      refreshOnOrderPayment,
    );

    return () => {
      window.removeEventListener(
        'project-goods:finance-updated',
        refreshOnOrderPayment,
      );
    };
  }, [refreshFinance]);

  const isLoading =
    activeCashboxesQuery.isLoading ||
    allCashboxesQuery.isLoading ||
    transactionsQuery.isLoading ||
    currenciesQuery.isLoading ||
    reportQuery.isLoading ||
    supplierOrdersQueueQuery.isLoading ||
    supplierOrdersQuery.isLoading;

  return {
    allCashboxes,
    cashboxes,
    currencies,
    isCashboxesOrderHydrated,
    isLoading,
    refreshFinance,
    report: reportQuery.data ?? null,
    setCashboxes,
    supplierOrders,
    supplierOrdersQueue,
    transactions,
  };
};
