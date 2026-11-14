import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import { queryClient, queryKeys } from '../../../shared/api/queryClient';
import type {
  CreateScenarioPayload,
  ScenarioDomain,
  ScenarioRecord,
  UpdateScenarioPayload,
} from '../model/types';

export const listScenarios = async (domain?: ScenarioDomain): Promise<ScenarioRecord[]> => {
  try {
    const response = await apiClient.get<ScenarioRecord[]>('/scenarios', {
      params: domain ? { domain } : undefined,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createScenario = async (payload: CreateScenarioPayload): Promise<ScenarioRecord> => {
  try {
    const response = await apiClient.post<ScenarioRecord>('/scenarios', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateScenario = async (
  scenarioId: string,
  payload: UpdateScenarioPayload,
): Promise<ScenarioRecord> => {
  try {
    const response = await apiClient.put<ScenarioRecord>(`/scenarios/${scenarioId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteScenario = async (scenarioId: string) => {
  try {
    const response = await apiClient.delete<{ deleted: boolean; id: string }>(
      `/scenarios/${scenarioId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const useScenariosQuery = (
  domain?: ScenarioDomain,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.scenarios(domain),
    queryFn: () => listScenarios(domain),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });

export const useCreateScenarioMutation = () =>
  useMutation({
    mutationFn: (payload: CreateScenarioPayload) => createScenario(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scenariosRoot });
    },
  });

export const useUpdateScenarioMutation = () =>
  useMutation({
    mutationFn: ({ scenarioId, payload }: { scenarioId: string; payload: UpdateScenarioPayload }) =>
      updateScenario(scenarioId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scenariosRoot });
    },
  });

export const useDeleteScenarioMutation = () =>
  useMutation({
    mutationFn: (scenarioId: string) => deleteScenario(scenarioId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scenariosRoot });
    },
  });
