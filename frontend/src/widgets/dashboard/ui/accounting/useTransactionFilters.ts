import { useEffect, useMemo, useState } from 'react';
import type { FinanceTransaction } from '../../../../entities/finance/model/types';
import {
  filterFinanceTransactions,
  getActiveTransactionFiltersCount,
  initialTransactionFilters,
  paginateAccountingItems,
  type TransactionFilters,
} from '../../model/accounting';

type UseTransactionFiltersOptions = {
  transactions: FinanceTransaction[];
};

export const useTransactionFilters = ({ transactions }: UseTransactionFiltersOptions) => {
  const [draftTransactionFilters, setDraftTransactionFilters] = useState<TransactionFilters>(
    initialTransactionFilters,
  );
  const [appliedTransactionFilters, setAppliedTransactionFilters] = useState<TransactionFilters>(
    initialTransactionFilters,
  );
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPageSize, setTransactionsPageSize] = useState(30);
  const [selectedTransactionCashboxId, setSelectedTransactionCashboxId] = useState('');

  const filteredTransactions = useMemo(
    () =>
      filterFinanceTransactions({
        filters: appliedTransactionFilters,
        selectedCashboxId: selectedTransactionCashboxId,
        transactions,
      }),
    [appliedTransactionFilters, selectedTransactionCashboxId, transactions],
  );

  const paginatedTransactions = useMemo(
    () =>
      paginateAccountingItems(
        filteredTransactions,
        transactionsPage,
        transactionsPageSize,
      ),
    [filteredTransactions, transactionsPage, transactionsPageSize],
  );

  const activeTransactionFiltersCount = useMemo(
    () => getActiveTransactionFiltersCount(appliedTransactionFilters),
    [appliedTransactionFilters],
  );

  // Clamp page when filtered set shrinks
  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredTransactions.length / transactionsPageSize),
    );
    if (transactionsPage > pageCount) {
      setTransactionsPage(pageCount);
    }
  }, [filteredTransactions.length, transactionsPage, transactionsPageSize]);

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
    filteredTransactions,
    paginatedTransactions,
    activeTransactionFiltersCount,
  };
};
