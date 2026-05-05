import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { Product } from '../../product/model/types';
import type {
  Sale,
  SaleFormValues,
  SaleLineItemReturnPayload,
  SaleReturnPayload,
  SaleWorkspacePayload,
} from '../model/types';

export const getSales = async () => {
  try {
    const response = await apiClient.get<Sale[]>('/sales');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createSale = async (payload: SaleFormValues) => {
  try {
    const response = await apiClient.post<{ sale: Sale; product: Product }>(
      '/sales',
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateSale = async (saleId: string, payload: SaleFormValues) => {
  try {
    const response = await apiClient.put<{ sale: Sale; product: Product }>(
      `/sales/${saleId}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateSaleWorkspace = async (
  saleId: string,
  payload: SaleWorkspacePayload,
) => {
  try {
    const response = await apiClient.patch<Sale>(
      `/sales/${saleId}/workspace`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteSale = async (saleId: string) => {
  try {
    const response = await apiClient.delete<{ id: string; restoredProductId: string }>(
      `/sales/${saleId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const returnSaleLineItem = async (
  saleId: string,
  payload: SaleLineItemReturnPayload,
) => {
  try {
    const response = await apiClient.patch<Sale>(
      `/sales/${saleId}/return-line-item`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const returnSale = async (
  saleId: string,
  payload: SaleReturnPayload,
) => {
  try {
    const response = await apiClient.patch<Sale>(
      `/sales/${saleId}/return`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
