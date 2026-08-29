// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { authTokenStorageKey } from '../../entities/auth/api/authApi';
import { queryClient, queryKeys } from './queryClient';
import {
  consumeSseBuffer,
  invalidateQueriesForLivePath,
  startLiveEvents,
} from './liveEvents';

const encodeChunk = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));

const sseResponse = (
  chunks: string[],
  options: { hang?: boolean; status?: number } = {},
) => {
  let index = 0;
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: () => ({
        cancel: async () => undefined,
        read: async () => {
          if (index < chunks.length) {
            const value = encodeChunk(chunks[index]);
            index += 1;
            return { done: false, value };
          }
          if (options.hang) {
            await new Promise(() => undefined);
          }
          return { done: true, value: undefined };
        },
      }),
    },
  };
};

let stopLiveEvents: (() => void) | undefined;

afterEach(() => {
  stopLiveEvents?.();
  stopLiveEvents = undefined;
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('invalidateQueriesForLivePath', () => {
  it('invalidates sales queries for sale mutations', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    invalidateQueriesForLivePath('/api/sales/abc/workspace');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.sales });
    spy.mockRestore();
  });
});

describe('consumeSseBuffer', () => {
  it('extracts complete data frames and keeps the remainder', () => {
    const paths: string[] = [];
    const rest = consumeSseBuffer(
      'data: {"path":"/api/sales"}\n\ndata: {"path":"/api/partial"',
      (path) => paths.push(path),
    );
    expect(paths).toEqual(['/api/sales']);
    expect(rest).toBe('data: {"path":"/api/partial"');
  });
});

describe('startLiveEvents', () => {
  it('reconnects after the stream ends and invalidates matching queries', async () => {
    window.localStorage.setItem(authTokenStorageKey, 'token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sseResponse(['data: {"path":"/api/sales"}\n\n']))
      .mockResolvedValue(sseResponse([], { hang: true }));
    vi.stubGlobal('fetch', fetchMock);

    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    stopLiveEvents = startLiveEvents({
      hiddenGraceMs: 0,
      initialBackoffMs: 5,
      maxBackoffMs: 5,
    });

    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.sales });
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    spy.mockRestore();
  });

  it('does not open a stream while another tab holds the leader lock', async () => {
    window.localStorage.setItem(authTokenStorageKey, 'token');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn(() => new Promise(() => undefined)),
      },
    });

    stopLiveEvents = startLiveEvents({ hiddenGraceMs: 0 });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 30);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'locks');
  });

  it('stops reconnecting after the consumer unmounts', async () => {
    window.localStorage.setItem(authTokenStorageKey, 'token');
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([': ping\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    stopLiveEvents = startLiveEvents({
      hiddenGraceMs: 0,
      initialBackoffMs: 5,
      maxBackoffMs: 5,
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    stopLiveEvents();
    stopLiveEvents = undefined;
    const callsAfterStop = fetchMock.mock.calls.length;
    await new Promise((resolve) => {
      window.setTimeout(resolve, 40);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterStop);
  });
});
