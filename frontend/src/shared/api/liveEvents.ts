import { queryClient, queryKeys } from './queryClient';
import { authTokenStorageKey } from '../../entities/auth/api/authApi';

const invalidateForPath = (path: string) => {
  if (path.includes('/sales')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sales });
  }
  if (path.includes('/products')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.products });
  }
  if (path.includes('/clients')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    void queryClient.invalidateQueries({ queryKey: queryKeys.clientDevices });
  }
  if (path.includes('/catalog-products')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.catalogProducts });
  }
  if (path.includes('/supplier-orders')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.supplierOrders });
  }
  if (path.includes('/finance')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.financeCashboxes });
    void queryClient.invalidateQueries({ queryKey: queryKeys.financeTransactions });
    void queryClient.invalidateQueries({ queryKey: queryKeys.financeReport });
  }
  if (path.includes('/employees')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.employees });
  }
  if (path.includes('/settings')) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
  }
};

export const invalidateQueriesForLivePath = invalidateForPath;

const eventsPath = () => {
  const base = import.meta.env.VITE_API_URL ?? '/api';
  return `${String(base).replace(/\/$/, '')}/events/stream`;
};

export const startLiveEvents = () => {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return () => undefined;
  }

  const abort = new AbortController();

  const connect = async () => {
    const token = window.localStorage.getItem(authTokenStorageKey);
    if (!token) return;

    try {
      const response = await fetch(eventsPath(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: abort.signal,
      });
      if (!response.ok || !response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!abort.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';
        chunks.forEach((chunk) => {
          const dataLine = chunk
            .split('\n')
            .find((line) => line.startsWith('data: '));
          if (!dataLine) return;
          try {
            const payload = JSON.parse(dataLine.slice(6)) as { path?: string };
            if (payload.path) invalidateForPath(payload.path);
          } catch {
            // ignore malformed frames
          }
        });
      }
    } catch {
      if (!abort.signal.aborted) {
        window.setTimeout(() => {
          void connect();
        }, 8000);
      }
    }
  };

  void connect();
  return () => abort.abort();
};
