import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type {
  CreateSavedFilterPayload,
  SavedFilterRecord,
  SavedFilterScope,
} from '../model/types';

export const listSavedFilters = async <TFilters = Record<string, unknown>>(
  scope: SavedFilterScope,
) => {
  try {
    const response = await apiClient.get<Array<SavedFilterRecord<TFilters>>>(
      '/saved-filters',
      { params: { scope } },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createSavedFilter = async <TFilters = Record<string, unknown>>(
  payload: CreateSavedFilterPayload<TFilters>,
) => {
  try {
    const response = await apiClient.post<SavedFilterRecord<TFilters>>(
      '/saved-filters',
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteSavedFilter = async (filterId: string) => {
  try {
    const response = await apiClient.delete<{ id: string; deleted: true }>(
      `/saved-filters/${filterId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
