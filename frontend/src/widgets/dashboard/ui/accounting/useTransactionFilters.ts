import { useEffect, useMemo, useState } from 'react';
import { useFinanceTransactionsQuery } from '../../../../entities/finance/api/financeApi';
import {
  FINANCE_TRANSACTIONS_DEFAULT_PAGE_SIZE,
  getActiveTransactionFiltersCount,
  initialTransactionFilters,
  toFinanceTransactionsListParams,
  type TransactionFilters,
} from '../../model/accounting';

type UseTransactionFiltersOptions = {
  enabled?: boolean;
};

export const useTransactionFilters = ({
  enabled = true,
}: UseTransactionFiltersOptions = {}) => {
  const [draftTransactionFilters, setDraftTransactionFilters] = useState<TransactionFilters>(
    initialTransactionFilters,
  );
  const [appliedTransactionFilters, setAppliedTransactionFilters] = useState<TransactionFilters>(
    initialTransactionFilters,
  );
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPageSize, setTransactionsPageSize] = useState(
    FINANCE_TRANSACTIONS_DEFAULT_PAGE_SIZE,
  );
  const [selectedTransactionCashboxId, setSelectedTransactionCashboxId] = useState('');

  const listParams = useMemo(
    () =>
      toFinanceTransactionsListParams({
        filters: appliedTransactionFilters,
        page: transactionsPage,
        pageSize: transactionsPageSize,
        selectedCashboxId: selectedTransactionCashboxId,
      }),
    [
      appliedTransactionFilters,
      selectedTransactionCashboxId,
      transactionsPage,
      transactionsPageSize,
    ],
  );

  const transactionsQuery = useFinanceTransactionsQuery(listParams, { enabled });

  const transactions = transactionsQuery.data?.items ?? [];
  const transactionsTotal = transactionsQuery.data?.total ?? 0;

  const balanceAfterByTransactionId = useMemo(
    () =>
      transactions.reduce<Record<string, number | null>>((acc, transaction) => {
        acc[transaction.id] = transaction.balanceAfter ?? null;
        return acc;
      }, {}),
    [transactions],
  );

  const activeTransactionFiltersCount = useMemo(
    () => getActiveTransactionFiltersCount(appliedTransactionFilters),
    [appliedTransactionFilters],
  );

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(transactionsTotal / transactionsPageSize),
    );
    if (transactionsPage > pageCount) {
      setTransactionsPage(pageCount);
    }
  }, [transactionsPage, transactionsPageSize, transactionsTotal]);

  const handleSetPageSize = (nextPageSize: number) => {
    setTransactionsPageSize(nextPageSize);
    setTransactionsPage(1);
  };

  const handleSetSelectedCashboxId = (cashboxId: string) => {
    setSelectedTransactionCashboxId(cashboxId);
    setTransactionsPage(1);
  };

  const handleSetPage = (page: number) => {
    setTransactionsPage(page);
  };

  return {
    draftTransactionFilters,
    setDraftTransactionFilters,
    appliedTransactionFilters,
    setAppliedTransactionFilters,
    transactionsPage,
    setTransactionsPage: handleSetPage,
    transactionsPageSize,
    setTransactionsPageSize: handleSetPageSize,
    selectedTransactionCashboxId,
    setSelectedTransactionCashboxId: handleSetSelectedCashboxId,
    transactions,
    transactionsTotal,
    balanceAfterByTransactionId,
    activeTransactionFiltersCount,
    isTransactionsLoading: transactionsQuery.isLoading,
    isTransactionsFetching: transactionsQuery.isFetching,
  };
};