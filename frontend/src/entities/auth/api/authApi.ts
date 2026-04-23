import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { Employee } from '../../employee/model/types';
import type { AuthSession, LoginPayload } from '../model/types';

export const authTokenStorageKey = 'project-goods.auth-token';

export const login = async (payload: LoginPayload) => {
  try {
    const response = await apiClient.post<AuthSession>('/auth/login', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getCurrentEmployee = async () => {
  try {
    const response = await apiClient.get<Employee>('/auth/me');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
