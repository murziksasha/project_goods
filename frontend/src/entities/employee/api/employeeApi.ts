import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/api/queryClient';
import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { Employee, EmployeeFormValues } from '../model/types';

export const useEmployeesQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.employees,
    queryFn: () => getEmployees(),
    enabled,
  });

export const getEmployees = async (query = '', role = 'all') => {
  try {
    const response = await apiClient.get<Employee[]>('/employees', {
      params:
        query || role !== 'all'
          ? {
              ...(query ? { query } : {}),
              ...(role !== 'all' ? { role } : {}),
            }
          : undefined,
    });

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createEmployee = async (payload: EmployeeFormValues) => {
  try {
    const response = await apiClient.post<Employee>('/employees', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateEmployee = async (
  employeeId: string,
  payload: EmployeeFormValues,
) => {
  try {
    const response = await apiClient.put<Employee>(`/employees/${employeeId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteEmployee = async (employeeId: string) => {
  try {
    await apiClient.delete(`/employees/${employeeId}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
