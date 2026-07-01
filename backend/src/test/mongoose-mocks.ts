import { vi } from 'vitest';

export const createLeanQueryMock = <T>(leanResult = vi.fn<() => Promise<T>>()) => {
  const lean = vi.fn(() => leanResult());
  const query = vi.fn(() => ({ lean }));
  return { query, lean, leanResult };
};

export const leanResult = <T>(value: T) => ({
  lean: vi.fn().mockResolvedValue(value),
});

export const leanSelectResult = <T>(value: T) => ({
  select: vi.fn().mockReturnValue(leanResult(value)),
});