import { ApiRequestError, apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { Product } from '../../product/model/types';
import type {
  Sale,
  SaleFormValues,
  SaleLineItemReturnPayload,
  SaleLineItemSerialReturnPayload,
  SaleLineItemStockReturnPayload,
  SalePaymentPayload,
  SaleRefundPaymentPayload,
  SaleReturnPayload,
  SaleWorkspacePayload,
} from '../model/types';

type CreateSaleResponse = {
  sale: Sale;
  product: Product | null;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSaleResponse = (value: unknown): value is Sale =>
  isObjectRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.saleDate === 'string' &&
  typeof value.kind === 'string' &&
  typeof value.status === 'string' &&
  typeof value.client === 'object' &&
  value.client !== null &&
  Array.isArray(value.timeline) &&
  Array.isArray(value.paymentHistory);

const ensureSaleResponse = (value: unknown, context: string): Sale => {
  if (isSaleResponse(value)) {
    return value;
  }

  throw new ApiRequestError(`Unexpected ${context} response from API.`);
};

const ensureCreateSaleResponse = (value: unknown): CreateSaleResponse => {
  if (isObjectRecord(value) && isSaleResponse(value.sale)) {
    return value as CreateSaleResponse;
  }

  throw new ApiRequestError('Unexpected create sale response from API.');
};

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
    const response = await apiClient.post<CreateSaleResponse>(
      '/sales',
      payload,
    );
    return ensureCreateSaleResponse(response.data);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateSale = async (saleId: string, payload: SaleFormValues) => {
  try {
    const response = await apiClient.put<CreateSaleResponse>(
      `/sales/${saleId}`,
      payload,
    );
    return ensureCreateSaleResponse(response.data);
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
    return ensureSaleResponse(response.data, 'sale workspace update');
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

export const acceptSalePayment = async (
  saleId: string,
  payload: SalePaymentPayload,
) => {
  try {
    const response = await apiClient.patch<Sale>(
      `/sales/${saleId}/payment`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const refundSalePayment = async (
  saleId: string,
  payload: SaleRefundPaymentPayload,
) => {
  try {
    const response = await apiClient.patch<Sale>(
      `/sales/${saleId}/refund`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const returnSaleLineItemBySerials = async (
  saleId: string,
  payload: SaleLineItemSerialReturnPayload,
) => {
  try {
    const response = await apiClient.patch<Sale>(
      `/sales/${saleId}/return-line-item-serials`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const returnSaleLineItemToStock = async (
  saleId: string,
  payload: SaleLineItemStockReturnPayload,
) => {
  try {
    const response = await apiClient.patch<Sale>(
      `/sales/${saleId}/return-line-item-stock`,
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
