import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../shared/api/queryClient';

describe('dashboard query invalidation contract', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.spyOn(queryClient, 'invalidateQueries');
  });

  it('invalidates sales and products after order mutations', async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.sales });
    await queryClient.invalidateQueries({ queryKey: queryKeys.products });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.sales,
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.products,
    });
  });

  it('invalidates clients after client mutations', async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.clients });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.clients,
    });
  });
});