import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import axios from 'axios';
import type {
  Cashbox,
  CreateCashboxPayload,
  CreateFinanceTransactionPayload,
  FinanceReport,
  FinanceTransaction,
  SupplierOrderPaymentQueueItem,
  UpdateCashboxPayload,
} from '../model/types';

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

export const getFinanceTransactions = async () => {
  try {
    const response = await apiClient.get<FinanceTransaction[]>('/finance/transactions');
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
