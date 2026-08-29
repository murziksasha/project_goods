import { queryClient, queryKeys } from './queryClient';
import { authTokenStorageKey } from '../../entities/auth/api/authApi';
import {
  clearLocalAuthSession,
  subscribeAuthSession,
} from '../../entities/auth/lib/sessionLifecycle';

export const liveEventsLockName = 'project-goods.live-events-leader';
export const liveEventsChannelName = 'project-goods.live-events';

export type StartLiveEventsOptions = {
  hiddenGraceMs?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
};

const DEFAULT_HIDDEN_GRACE_MS = 1000;
const DEFAULT_INITIAL_BACKOFF_MS = 1000;
const DEFAULT_MAX_BACKOFF_MS = 30_000;

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
    void queryClient.invalidateQueries({ queryKey: queryKeys.financeCurrencies });
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

export const consumeSseBuffer = (
  buffer: string,
  onPath: (path: string) => void,
) => {
  const chunks = buffer.split('\n\n');
  const rest = chunks.pop() ?? '';
  chunks.forEach((chunk) => {
    const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));
    if (!dataLine) return;
    try {
      const payload = JSON.parse(dataLine.slice(6)) as { path?: string };
      if (payload.path) onPath(payload.path);
    } catch {
      // ignore malformed frames
    }
  });
  return rest;
};

const eventsPath = () => {
  const base = import.meta.env.VITE_API_URL ?? '/api';
  return `${String(base).replace(/\/$/, '')}/events/stream`;
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    let timeoutId = 0;
    const onAbort = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    signal.addEventListener('abort', onAbort, { once: true });
  });

const waitUntilAborted = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener('abort', () => resolve(), { once: true });
  });

const waitUntilVisible = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted || typeof document === 'undefined') {
      resolve();
      return;
    }
    if (document.visibilityState === 'visible') {
      resolve();
      return;
    }
    const onChange = () => {
      if (document.visibilityState === 'visible') finish();
    };
    const finish = () => {
      document.removeEventListener('visibilitychange', onChange);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    document.addEventListener('visibilitychange', onChange);
    signal.addEventListener('abort', finish);
  });

const linkHiddenAbort = (parent: AbortSignal, graceMs: number) => {
  const child = new AbortController();
  let graceTimer: number | undefined;

  const abortChild = () => {
    if (!child.signal.aborted) child.abort();
  };

  const onParentAbort = () => abortChild();

  const onVisibility = () => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'hidden') {
      if (graceTimer !== undefined) {
        window.clearTimeout(graceTimer);
        graceTimer = undefined;
      }
      return;
    }
    if (graceMs <= 0) {
      abortChild();
      return;
    }
    if (graceTimer !== undefined) return;
    graceTimer = window.setTimeout(() => {
      graceTimer = undefined;
      if (document.visibilityState === 'hidden') abortChild();
    }, graceMs);
  };

  parent.addEventListener('abort', onParentAbort);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
  }

  return {
    signal: child.signal,
    dispose: () => {
      parent.removeEventListener('abort', onParentAbort);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (graceTimer !== undefined) window.clearTimeout(graceTimer);
      abortChild();
    },
  };
};

const readLiveStream = async (
  token: string,
  signal: AbortSignal,
  onPath: (path: string) => void,
) => {
  const response = await fetch(eventsPath(), {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (response.status === 401) {
    clearLocalAuthSession();
    return 'unauthorized' as const;
  }

  if (!response.ok || !response.body) {
    return 'retry' as const;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const cancelReader = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancelReader, { once: true });

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) return 'retry' as const;
      buffer += decoder.decode(value, { stream: true });
      buffer = consumeSseBuffer(buffer, onPath);
    }
  } finally {
    signal.removeEventListener('abort', cancelReader);
    cancelReader();
  }

  return 'retry' as const;
};

const connectLoop = async (
  signal: AbortSignal,
  onPath: (path: string) => void,
  initialBackoffMs: number,
  maxBackoffMs: number,
) => {
  let backoffMs = initialBackoffMs;

  while (!signal.aborted) {
    const token = window.localStorage.getItem(authTokenStorageKey);
    if (!token) {
      await waitUntilAborted(signal);
      break;
    }

    const startedAt = Date.now();
    try {
      const result = await readLiveStream(token, signal, onPath);
      if (result === 'unauthorized' || signal.aborted) break;
    } catch {
      if (signal.aborted) break;
    }

    if (Date.now() - startedAt > 5_000) {
      backoffMs = initialBackoffMs;
    } else {
      backoffMs = Math.min(Math.max(backoffMs, 1) * 2, maxBackoffMs);
    }
    await wait(backoffMs, signal);
  }
};

const createLiveEventsChannel = () => {
  if (typeof BroadcastChannel !== 'function') return null;
  try {
    return new BroadcastChannel(liveEventsChannelName);
  } catch {
    return null;
  }
};

const requestLeaderLock = async (
  callback: () => Promise<void>,
  signal: AbortSignal,
) => {
  const locks = navigator.locks;
  if (!locks || typeof locks.request !== 'function') {
    await callback();
    return;
  }

  await locks.request(liveEventsLockName, { signal }, callback);
};

export const startLiveEvents = (options: StartLiveEventsOptions = {}) => {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return () => undefined;
  }

  const hiddenGraceMs = options.hiddenGraceMs ?? DEFAULT_HIDDEN_GRACE_MS;
  const initialBackoffMs = options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
  const maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  const stopped = new AbortController();
  const channel = createLiveEventsChannel();

  const isDocumentHidden = () =>
    typeof document !== 'undefined' && document.visibilityState === 'hidden';

  const handlePath = (path: string) => {
    if (!isDocumentHidden()) invalidateForPath(path);
    channel?.postMessage({ type: 'resource.changed', path });
  };

  if (channel) {
    channel.onmessage = (event: MessageEvent) => {
      if (isDocumentHidden()) return;
      const payload = event.data as { path?: string } | null;
      if (payload?.path) invalidateForPath(payload.path);
    };
  }

  const unsubscribeAuth = subscribeAuthSession((event) => {
    if (event.type === 'cleared') stopped.abort();
  });

  const onStorage = (event: StorageEvent) => {
    if (event.key === authTokenStorageKey && !event.newValue) {
      stopped.abort();
    }
  };
  window.addEventListener('storage', onStorage);

  const run = async () => {
    while (!stopped.signal.aborted) {
      await waitUntilVisible(stopped.signal);
      if (stopped.signal.aborted) return;

      const session = linkHiddenAbort(stopped.signal, hiddenGraceMs);
      try {
        await requestLeaderLock(async () => {
          await connectLoop(
            session.signal,
            handlePath,
            initialBackoffMs,
            maxBackoffMs,
          );
        }, session.signal);
      } catch {
        // lock / fetch aborted when the tab hides or unmounts
      } finally {
        session.dispose();
      }
    }
  };

  void run();

  return () => {
    stopped.abort();
    unsubscribeAuth();
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
};
