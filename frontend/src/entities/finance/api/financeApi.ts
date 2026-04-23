import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type {
  Cashbox,
  CreateCashboxPayload,
  CreateFinanceTransactionPayload,
  FinanceReport,
  FinanceTransaction,
} from '../model/types';

export const getCashboxes = async () => {
  try {
    const response = await apiClient.get<Cashbox[]>('/finance/cashboxes');
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

export const getFinanceReport = async () => {
  try {
    const response = await apiClient.get<FinanceReport>('/finance/report');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
