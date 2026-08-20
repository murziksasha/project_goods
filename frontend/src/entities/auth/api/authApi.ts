import {
  apiClient,
  createApiRequestError,
  getApiErrorMessage,
} from '../../../shared/api/http';
import type {
  Employee,
  EmployeeUiPreferences,
} from '../../employee/model/types';
import type { AuthSession, InvitationDetails, LoginPayload } from '../model/types';

export const authTokenStorageKey = 'project-goods.auth-token';

export const login = async (payload: LoginPayload) => {
  try {
    const response = await apiClient.post<AuthSession>('/auth/login', payload);
    return response.data;
  } catch (error) {
    throw createApiRequestError(error);
  }
};

export const getCurrentEmployee = async () => {
  try {
    const response = await apiClient.get<Employee>('/auth/me');
    return response.data;
  } catch (error) {
    throw createApiRequestError(error);
  }
};

export const updateCurrentEmployeePreferences = async (
  payload: EmployeeUiPreferences,
) => {
  try {
    const response = await apiClient.patch<Employee>(
      '/auth/me/preferences',
      payload,
    );
    return response.data;
  } catch (error) {
    throw createApiRequestError(error);
  }
};

export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    throw createApiRequestError(error);
  }
};

export const getInvitationDetails = async (token: string) => {
  try {
    const response = await apiClient.get<InvitationDetails>(`/auth/invitations/${token}`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const acceptInvitation = async (token: string, payload: LoginPayload) => {
  try {
    const response = await apiClient.post<AuthSession>(`/auth/invitations/${token}/register`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
