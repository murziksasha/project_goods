import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, queryKeys } from '../../../shared/api/queryClient';
import { foldOpexCategoryIntoOther } from '../model/category-label';
import {
  OTHER_CATEGORY_SLUG,
  type Cashbox,
  type CreateCashboxPayload,
  type CreateFinanceCategoryPayload,
  type CreateFinanceCurrencyPayload,
  type CreateFinanceTransactionPayload,
  type FinanceCategory,
  type FinanceCurrencyConfig,
  type FinanceProfitReport,
  type FinanceReport,
  type FinanceTransaction,
  type ProfitReportParams,
  type FinanceTransactionsListParams,
  type FinanceTransactionsPage,
  type SupplierOrderPaymentQueueItem,
  type UpdateCashboxPayload,
  type UpdateFinanceCategoryPayload,
  type UpdateFinanceCurrencyPayload,
  type UpdateFinanceTransactionPayload,
} from '../model/types';

const invalidateFinanceQueries = () => {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.financeCashboxes }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financeCurrencies }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financeCategories }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financeTransactions }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financeReport }),
    queryClient.invalidateQueries({ queryKey: ['financeProfitReport'] }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.financeSupplierOrdersQueue,
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financeSettings }),
    queryClient.invalidateQueries({ queryKey: queryKeys.supplierOrders }),
  ]);
};

const invalidateFinanceCategoryQueries = () => {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.financeCategories }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financeTransactions }),
    queryClient.invalidateQueries({ queryKey: ['financeProfitReport'] }),
  ]);
};

const patchFinanceCategoriesCache = (
  updater: (categories: FinanceCategory[]) => FinanceCategory[],
) => {
  queryClient.setQueryData<FinanceCategory[]>(
    queryKeys.financeCategories,
    (current) => (current ? updater(current) : current),
  );
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

export const getFinanceCategories = async () => {
  try {
    const response = await apiClient.get<FinanceCategory[]>('/finance/categories');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createFinanceCategory = async (
  payload: CreateFinanceCategoryPayload,
) => {
  try {
    const response = await apiClient.post<FinanceCategory>(
      '/finance/categories',
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateFinanceCategory = async (
  slug: string,
  payload: UpdateFinanceCategoryPayload,
) => {
  try {
    const response = await apiClient.patch<FinanceCategory>(
      `/finance/categories/${slug}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteFinanceCategory = async (slug: string) => {
  try {
    const response = await apiClient.delete<{ ok: true }>(
      `/finance/categories/${slug}`,
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
  if (params.category) query.category = params.category;
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

export const getFinanceProfitReport = async (params: ProfitReportParams = {}) => {
  try {
    const response = await apiClient.get<FinanceProfitReport>(
      '/finance/profit-report',
      { params },
    );
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

export const useFinanceCategoriesQuery = (
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    enabled: options.enabled,
    queryFn: getFinanceCategories,
    queryKey: queryKeys.financeCategories,
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

export const useFinanceProfitReportQuery = (
  params: ProfitReportParams = {},
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    enabled: options.enabled,
    queryFn: () => getFinanceProfitReport(params),
    queryKey: queryKeys.financeProfitReport({
      period: params.period ?? 'whole',
      dateFrom: params.dateFrom ?? '',
      dateTo: params.dateTo ?? '',
      source: params.source ?? 'all',
    }),
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

export const useCreateFinanceCategoryMutation = () =>
  useMutation({
    mutationFn: createFinanceCategory,
    onSuccess: (created) => {
      patchFinanceCategoriesCache((categories) => [...categories, created]);
      invalidateFinanceCategoryQueries();
    },
  });

export const useUpdateFinanceCategoryMutation = () =>
  useMutation({
    mutationFn: ({
      slug,
      payload,
    }: {
      slug: string;
      payload: UpdateFinanceCategoryPayload;
    }) => updateFinanceCategory(slug, payload),
    onMutate: async ({ slug, payload }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.financeCategories });
      const previous = queryClient.getQueryData<FinanceCategory[]>(
        queryKeys.financeCategories,
      );
      patchFinanceCategoriesCache((categories) =>
        categories.map((category) =>
          category.slug === slug ? { ...category, ...payload } : category,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.financeCategories, context.previous);
      }
    },
    onSuccess: (updated) => {
      patchFinanceCategoriesCache((categories) =>
        categories.map((category) =>
          category.slug === updated.slug ? updated : category,
        ),
      );
      invalidateFinanceCategoryQueries();
    },
  });

const reassignDeletedCategoryInProfitReports = (slug: string) => {
  queryClient.setQueriesData<FinanceProfitReport>(
    { queryKey: ['financeProfitReport'] },
    (current) => {
      if (!current?.cash) return current;
      return {
        ...current,
        cash: {
          ...current.cash,
          opexByCategory: foldOpexCategoryIntoOther(
            current.cash.opexByCategory,
            slug,
          ),
          operations: current.cash.operations.map((operation) =>
            operation.category === slug
              ? { ...operation, category: OTHER_CATEGORY_SLUG }
              : operation,
          ),
        },
      };
    },
  );
};

export const useDeleteFinanceCategoryMutation = () =>
  useMutation({
    mutationFn: deleteFinanceCategory,
    onSuccess: (_result, slug) => {
      patchFinanceCategoriesCache((categories) =>
        categories.filter((category) => category.slug !== slug),
      );
      reassignDeletedCategoryInProfitReports(slug);
      invalidateFinanceCategoryQueries();
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
