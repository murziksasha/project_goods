import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/api/queryClient';
import { useVisibleRefetchInterval } from '../../../shared/lib/visible-refetch';
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

export type SalesListParams = {
  kind?: 'sale' | 'repair';
  status?: string;
  statuses?: string[];
  excludeStatuses?: string[];
  dateFrom?: string;
  dateTo?: string;
  isFavorite?: boolean;
  isRapidSale?: boolean;
  clientId?: string;
  assigneeId?: string;
  masterId?: string;
  recordNumber?: string;
  client?: string;
  product?: string;
  service?: string;
  repairType?: 'paid' | 'warranty';
  paymentMethod?: 'cash' | 'non-cash';
  q?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
  compact?: boolean;
};

export type SalesListPage = {
  items: Sale[];
  total: number;
  page: number;
  pageSize: number;
};

export const buildSalesListQuery = (params: SalesListParams = {}) => {
  const query: Record<string, string> = {};
  if (params.kind) query.kind = params.kind;
  if (params.status) query.status = params.status;
  if (params.statuses?.length) query.statuses = params.statuses.join(',');
  if (params.excludeStatuses?.length) {
    query.excludeStatuses = params.excludeStatuses.join(',');
  }
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;
  if (params.isFavorite !== undefined) query.isFavorite = String(params.isFavorite);
  if (params.isRapidSale !== undefined) query.isRapidSale = String(params.isRapidSale);
  if (params.clientId) query.clientId = params.clientId;
  if (params.assigneeId) query.assigneeId = params.assigneeId;
  if (params.masterId) query.masterId = params.masterId;
  if (params.recordNumber) query.recordNumber = params.recordNumber;
  if (params.client) query.client = params.client;
  if (params.product) query.product = params.product;
  if (params.service) query.service = params.service;
  if (params.repairType) query.repairType = params.repairType;
  if (params.paymentMethod) query.paymentMethod = params.paymentMethod;
  if (params.q) query.q = params.q;
  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.page !== undefined) query.page = String(params.page);
  if (params.pageSize !== undefined) query.pageSize = String(params.pageSize);
  if (params.compact) query.compact = '1';
  return query;
};

export const useSalesQuery = (
  enabled = true,
  params: SalesListParams = {},
  options: { poll?: boolean } = {},
) => {
  const listParams = { compact: true, ...params };
  const refetchInterval = useVisibleRefetchInterval(
    15_000,
    Boolean(enabled && options.poll),
  );
  return useQuery({
    queryKey: queryKeys.salesList(listParams),
    queryFn: () => getSales(listParams),
    enabled,
    staleTime: 15_000,
    refetchInterval,
  });
};

export type OccupiedSerialNumbersResponse = {
  occupied: string[];
};

export const getOccupiedSerialNumbers = async ({
  excludeSaleId,
  serials,
}: {
  excludeSaleId?: string;
  serials: string[];
}): Promise<OccupiedSerialNumbersResponse> => {
  const uniqueSerials = Array.from(
    new Set(serials.map((serial) => String(serial ?? '').trim()).filter(Boolean)),
  );
  if (uniqueSerials.length === 0) {
    return { occupied: [] };
  }

  try {
    const response = await apiClient.get<OccupiedSerialNumbersResponse>(
      '/sales/occupied-serials',
      {
        params: {
          serials: uniqueSerials.join(','),
          ...(excludeSaleId ? { excludeSaleId } : {}),
        },
      },
    );
    const occupied = Array.isArray(response.data?.occupied)
      ? response.data.occupied
      : [];
    return { occupied };
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getSaleById = async (saleId: string) => {
  try {
    const response = await apiClient.get<Sale>(`/sales/${saleId}`);
    return ensureSaleResponse(response.data, 'sale');
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getSales = async (params: SalesListParams = {}) => {
  try {
    const response = await apiClient.get<Sale[]>('/sales', {
      params: buildSalesListQuery(params),
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getSalesPage = async (params: SalesListParams = {}) => {
  try {
    const response = await apiClient.get<SalesListPage>('/sales', {
      params: buildSalesListQuery({ compact: true, page: 1, ...params }),
    });
    const data = response.data;
    if (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.items) &&
      typeof data.total === 'number'
    ) {
      return data;
    }
    throw new ApiRequestError('Unexpected sales page response from API.');
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const useSalesPageQuery = (
  enabled = true,
  params: SalesListParams = {},
  options: { poll?: boolean } = {},
) => {
  const listParams = { compact: true, page: 1, ...params };
  const refetchInterval = useVisibleRefetchInterval(
    15_000,
    Boolean(enabled && options.poll),
  );
  return useQuery({
    queryKey: queryKeys.salesList(listParams),
    queryFn: () => getSalesPage(listParams),
    enabled,
    staleTime: 15_000,
    refetchInterval,
    placeholderData: (previous) => previous,
  });
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

export const updateSaleFavorite = async (
  saleId: string,
  payload: { isFavorite: boolean },
) => {
  try {
    const response = await apiClient.patch<Sale>(
      `/sales/${saleId}/favorite`,
      payload,
    );
    return ensureSaleResponse(response.data, 'sale favorite update');
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
