// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVisibleRefetchInterval } from './visible-refetch';

describe('useVisibleRefetchInterval', () => {
  it('returns the interval while the document is visible', () => {
    const { result } = renderHook(() => useVisibleRefetchInterval(15_000, true));
    expect(result.current).toBe(15_000);
  });

  it('disables the interval when hidden or disabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useVisibleRefetchInterval(15_000, enabled),
      { initialProps: { enabled: true } },
    );

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    rerender({ enabled: false });
    expect(result.current).toBe(false);
  });
});
