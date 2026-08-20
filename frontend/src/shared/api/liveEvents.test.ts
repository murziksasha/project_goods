import { describe, expect, it, vi } from 'vitest';
import { queryClient, queryKeys } from './queryClient';
import { invalidateQueriesForLivePath } from './liveEvents';

describe('invalidateQueriesForLivePath', () => {
  it('invalidates sales queries for sale mutations', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    invalidateQueriesForLivePath('/api/sales/abc/workspace');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.sales });
    spy.mockRestore();
  });
});
