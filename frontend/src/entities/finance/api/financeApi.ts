import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, queryKeys } from '../../../shared/api/queryClient';
import type {
  Cashbox,
  CreateCashboxPayload,
  CreateFinanceCurrencyPayload,
  CreateFinanceTransactionPayload,
  FinanceCurrencyConfig,
  FinanceReport,
  FinanceTransaction,
  FinanceTransactionsListParams,
  FinanceTransactionsPage,
  SupplierOrderPaymentQueueItem,
  UpdateCashboxPayload,
  UpdateFinanceCurrencyPayload,
  UpdateFinanceTransactionPayload,
} from '../model/types';

const invalidateFinanceQueries = () => {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.financeCashboxes }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financeCurrencies }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financeTransactions }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financeReport }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.financeSupplierOrdersQueue,
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financeSettings }),
    queryClient.invalidateQueries({ queryKey: queryKeys.supplierOrders }),
  ]);
};

export const getCashboxes = async (options: { includeArchived?: boolean } = {}) => {
  try {
    const response = await apiClient.get<Cashbox[]>('/finance/cashboxes', {
      params: options.includeArchived ? { includeArchived: '1' } : undefined,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createCashbox = async (payload: CreateCashboxPayload) => {
  try {
    const response = await apiClient.post<Cashbox>('/finance/cashboxes', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateCashbox = async (
  cashboxId: string,
  payload: UpdateCashboxPayload,
) => {
  try {
    const response = await apiClient.patch<Cashbox>(`/finance/cashboxes/${cashboxId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getFinanceCurrencies = async (options: { includeArchived?: boolean } = {}) => {
  try {
    const response = await apiClient.get<FinanceCurrencyConfig[]>('/finance/currencies', {
      params: options.includeArchived ? { includeArchived: '1' } : undefined,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createFinanceCurrency = async (
  payload: CreateFinanceCurrencyPayload,
) => {
  try {
    const response = await apiClient.post<FinanceCurrencyConfig>(
      '/finance/currencies',
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateFinanceCurrency = async (
  currencyCode: string,
  payload: UpdateFinanceCurrencyPayload,
) => {
  try {
    const response = await apiClient.patch<FinanceCurrencyConfig>(
      `/finance/currencies/${currencyCode}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

const buildFinanceTransactionsQueryParams = (
  params: FinanceTransactionsListParams = {},
) => {
  const query: Record<string, string | number> = {};

  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;
  if (params.type) query.type = params.type;
  if (params.currency) query.currency = params.currency;
  if (params.fromCashboxId) query.fromCashboxId = params.fromCashboxId;
  if (params.toCashboxId) query.toCashboxId = params.toCashboxId;
  if (params.cashboxId) query.cashboxId = params.cashboxId;
  if (params.note) query.note = params.note;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortDirection) query.sortDirection = params.sortDirection;

  return query;
};

export const getFinanceTransactions = async (
  params: FinanceTransactionsListParams = {},
) => {
  try {
    const response = await apiClient.get<FinanceTransactionsPage>(
      '/finance/transactions',
      { params: buildFinanceTransactionsQueryParams(params) },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createFinanceTransaction = async (
  payload: CreateFinanceTransactionPayload,
) => {
  try {
    const response = await apiClient.post<FinanceTransaction>(
      '/finance/transactions',
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const cancelFinanceTransaction = async (transactionId: string) => {
  try {
    const response = await apiClient.post<FinanceTransaction>(
      `/finance/transactions/${transactionId}/cancel`,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateFinanceTransaction = async (
  transactionId: string,
  payload: UpdateFinanceTransactionPayload,
) => {
  try {
    const response = await apiClient.patch<FinanceTransaction>(
      `/finance/transactions/${transactionId}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getFinanceReport = async () => {
  try {
    const response = await apiClient.get<FinanceReport>('/finance/report');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getSupplierOrdersForPayment = async () => {
  try {
    const response = await apiClient.get<SupplierOrderPaymentQueueItem[]>('/finance/supplier-orders');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const paySupplierOrder = async (supplierOrderId: string, payload: { cashboxId: string; note?: string }) => {
  try {
    const response = await apiClient.post(`/finance/supplier-orders/${supplierOrderId}/pay`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const issueSupplierOrderWithoutPayment = async (supplierOrderId: string) => {
  try {
    const response = await apiClient.post(`/finance/supplier-orders/${supplierOrderId}/issue-without-payment`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      try {
        const fallbackResponse = await apiClient.post(`/supplier-orders/${supplierOrderId}/issue-without-payment`);
        return fallbackResponse.data;
      } catch (fallbackError) {
        throw new Error(getApiErrorMessage(fallbackError));
      }
    }
    throw new Error(getApiErrorMessage(error));
  }
};

export const useCashboxesQuery = (
  options: { includeArchived?: boolean; enabled?: boolean } = {},
) =>
  useQuery({
    enabled: options.enabled,
    queryFn: () => getCashboxes({ includeArchived: options.includeArchived }),
    queryKey: options.includeArchived
      ? queryKeys.financeAllCashboxes
      : queryKeys.financeCashboxes,
  });

export const useFinanceCurrenciesQuery = (
  options: { includeArchived?: boolean; enabled?: boolean } = {},
) =>
  useQuery({
    enabled: options.enabled,
    queryFn: () =>
      getFinanceCurrencies({ includeArchived: options.includeArchived }),
    queryKey: options.includeArchived
      ? [...queryKeys.financeCurrencies, 'all']
      : queryKeys.financeCurrencies,
  });

export const useFinanceTransactionsQuery = (
  params: FinanceTransactionsListParams = {},
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    enabled: options.enabled,
    queryFn: () => getFinanceTransactions(params),
    queryKey: queryKeys.financeTransactionsList(
      buildFinanceTransactionsQueryParams(params),
    ),
    placeholderData: (previousData) => previousData,
  });

export const useFinanceReportQuery = (
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    enabled: options.enabled,
    queryFn: getFinanceReport,
    queryKey: queryKeys.financeReport,
  });

export const useSupplierOrdersForPaymentQuery = (
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    enabled: options.enabled,
    queryFn: getSupplierOrdersForPayment,
    queryKey: queryKeys.financeSupplierOrdersQueue,
  });

export const useCreateCashboxMutation = () =>
  useMutation({
    mutationFn: createCashbox,
    onSuccess: () => {
      invalidateFinanceQueries();
    },
  });

export const useUpdateCashboxMutation = () =>
  useMutation({
    mutationFn: ({
      cashboxId,
      payload,
    }: {
      cashboxId: string;
      payload: UpdateCashboxPayload;
    }) => updateCashbox(cashboxId, payload),
    onSuccess: () => {
      invalidateFinanceQueries();
    },
  });

export const useCreateFinanceTransactionMutation = () =>
  useMutation({
    mutationFn: createFinanceTransaction,
    onSuccess: () => {
      invalidateFinanceQueries();
    },
  });

export const useCancelFinanceTransactionMutation = () =>
  useMutation({
    mutationFn: cancelFinanceTransaction,
    onSuccess: () => {
      invalidateFinanceQueries();
    },
  });

export const useCreateFinanceCurrencyMutation = () =>
  useMutation({
    mutationFn: createFinanceCurrency,
    onSuccess: () => {
      invalidateFinanceQueries();
    },
  });

export const useUpdateFinanceCurrencyMutation = () =>
  useMutation({
    mutationFn: ({
      currencyCode,
      payload,
    }: {
      currencyCode: string;
      payload: UpdateFinanceCurrencyPayload;
    }) => updateFinanceCurrency(currencyCode, payload),
    onSuccess: () => {
      invalidateFinanceQueries();
    },
  });

export const usePaySupplierOrderMutation = () =>
  useMutation({
    mutationFn: ({
      supplierOrderId,
      payload,
    }: {
      supplierOrderId: string;
      payload: { cashboxId: string; note?: string };
    }) => paySupplierOrder(supplierOrderId, payload),
    onSuccess: () => {
      invalidateFinanceQueries();
    },
  });

export const useIssueSupplierOrderWithoutPaymentMutation = () =>
  useMutation({
    mutationFn: issueSupplierOrderWithoutPayment,
    onSuccess: () => {
      invalidateFinanceQueries();
    },
  });

export const useUpdateFinanceTransactionMutation = () =>
  useMutation({
    mutationFn: ({
      transactionId,
      payload,
    }: {
      transactionId: string;
      payload: UpdateFinanceTransactionPayload;
    }) => updateFinanceTransaction(transactionId, payload),
    onSuccess: () => {
      invalidateFinanceQueries();
    },
  });
