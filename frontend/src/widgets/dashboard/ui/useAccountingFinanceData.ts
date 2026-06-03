import { useCallback, useEffect, useState } from 'react';
import {
  getCashboxes,
  getFinanceReport,
  getFinanceTransactions,
  getSupplierOrdersForPayment,
} from '../../../entities/finance/api/financeApi';
import type {
  Cashbox,
  FinanceReport,
  FinanceTransaction,
  SupplierOrderPaymentQueueItem,
} from '../../../entities/finance/model/types';
import { getSupplierOrders } from '../../../entities/supplier-order/api/supplierOrderApi';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import {
  accountingCashboxOrderStorageKey,
  applyCashboxOrder,
} from '../model/accounting';

type UseAccountingFinanceDataOptions = {
  onError: (message: string) => void;
};

export const useAccountingFinanceData = ({
  onError,
}: UseAccountingFinanceDataOptions) => {
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [allCashboxes, setAllCashboxes] = useState<Cashbox[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
  const [supplierOrdersQueue, setSupplierOrdersQueue] = useState<
    SupplierOrderPaymentQueueItem[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCashboxesOrderHydrated, setIsCashboxesOrderHydrated] =
    useState(false);

  const refreshFinance = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        activeCashboxesData,
        allCashboxesData,
        transactionsData,
        reportData,
        supplierOrdersData,
      ] = await Promise.all([
        getCashboxes(),
        getCashboxes({ includeArchived: true }),
        getFinanceTransactions(),
        getFinanceReport(),
        getSupplierOrdersForPayment(),
      ]);
      const allSupplierOrders = await getSupplierOrders();
      let orderedCashboxes = activeCashboxesData;
      try {
        const storedOrder = JSON.parse(
          window.localStorage.getItem(accountingCashboxOrderStorageKey) ?? '[]',
        ) as string[];
        if (Array.isArray(storedOrder)) {
          orderedCashboxes = applyCashboxOrder(activeCashboxesData, storedOrder);
        }
      } catch {
        orderedCashboxes = activeCashboxesData;
      }
      setCashboxes(orderedCashboxes);
      setAllCashboxes(allCashboxesData);
      setIsCashboxesOrderHydrated(true);
      setTransactions(transactionsData);
      setReport(reportData);
      setSupplierOrdersQueue(supplierOrdersData);
      setSupplierOrders(allSupplierOrders);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Failed to load finance data.',
      );
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

  return {
    allCashboxes,
    cashboxes,
    isCashboxesOrderHydrated,
    isLoading,
    refreshFinance,
    report,
    setCashboxes,
    supplierOrders,
    supplierOrdersQueue,
    transactions,
  };
};
