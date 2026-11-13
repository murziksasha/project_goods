import { describe, expect, it, vi } from 'vitest';
import { fetchAllExportBatches, flattenReportGroups } from './orders-reports-export';

describe('fetchAllExportBatches', () => {
  it('loops every batch until nextCursor is null, including totals above 200 and 1000', async () => {
    const pages = [
      { items: Array.from({ length: 1000 }, (_, i) => i), nextCursor: 'p2', total: 1205 },
      { items: Array.from({ length: 205 }, (_, i) => 1000 + i), nextCursor: null, total: 1205 },
    ];
    const fetchPage = vi.fn(async (cursor?: string) => {
      if (!cursor) return pages[0]!;
      expect(cursor).toBe('p2');
      return pages[1]!;
    });
    const progress: Array<[number, number]> = [];
    const all = await fetchAllExportBatches(fetchPage, {
      onProgress: (loaded, total) => progress.push([loaded, total]),
    });
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(all).toHaveLength(1205);
    expect(all[0]).toBe(0);
    expect(all[1204]).toBe(1204);
    expect(progress).toEqual([
      [1000, 1205],
      [1205, 1205],
    ]);
  });

  it('stops immediately when aborted and throws AbortError', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchAllExportBatches(async () => ({ items: [1], nextCursor: 'x', total: 2 }), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('flattenReportGroups', () => {
  it('walks two levels in document order', () => {
    const flat = flattenReportGroups([
      {
        key: 'a',
        children: [{ key: 'a1' }, { key: 'a2', children: [] }],
      },
      { key: 'b' },
    ]);
    expect(flat.map((g) => g.key)).toEqual(['a', 'a1', 'a2', 'b']);
  });
});
