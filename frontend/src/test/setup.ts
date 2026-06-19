import '@testing-library/jest-dom/vitest';

const createStorageMock = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    },
  };
};

if (typeof window !== 'undefined') {
  const storage = window.localStorage;
  if (
    typeof storage?.getItem !== 'function' ||
    typeof storage?.setItem !== 'function' ||
    typeof storage?.clear !== 'function'
  ) {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createStorageMock(),
    });
  }

  // Polyfill for ResizeObserver (used by TruncatedTextTooltip and any component
  // that performs overflow/resize observation). jsdom does not implement it.
  // A minimal no-op implementation is sufficient because consuming tests
  // that need layout detection manually patch scrollWidth/clientWidth and/or
  // dispatch 'resize' events to trigger recompute.
  if (!(window as any).ResizeObserver) {
    (window as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
