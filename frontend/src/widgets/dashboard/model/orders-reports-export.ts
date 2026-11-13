export type ExportBatch<T> = {
  items: T[];
  nextCursor: string | null;
  total: number;
};

export const fetchAllExportBatches = async <T>(
  fetchPage: (cursor?: string) => Promise<ExportBatch<T>>,
  options: {
    signal?: AbortSignal;
    onProgress?: (loaded: number, total: number) => void;
  } = {},
): Promise<T[]> => {
  const all: T[] = [];
  let cursor: string | undefined;
  let guard = 0;
  do {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const page = await fetchPage(cursor);
    all.push(...page.items);
    options.onProgress?.(all.length, page.total);
    cursor = page.nextCursor ?? undefined;
    guard += 1;
    if (page.items.length === 0) break;
    if (guard > 1_000_000) break;
  } while (cursor);
  return all;
};

export const flattenReportGroups = <
  G extends { children?: G[] },
>(
  groups: G[],
): G[] => {
  const out: G[] = [];
  for (const group of groups) {
    out.push(group);
    if (group.children && group.children.length > 0) {
      out.push(...flattenReportGroups(group.children));
    }
  }
  return out;
};
