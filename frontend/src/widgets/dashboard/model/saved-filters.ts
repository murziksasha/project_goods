export type SavedFilter<TFilters, TTab extends string> = {
  id: string;
  employeeId: string;
  name: string;
  icon: string;
  tab: TTab;
  filters: TFilters;
  createdAt: string;
};

export const readSavedFilters = <TFilters, TTab extends string>(
  storageKey: string,
  tabs: readonly TTab[],
): Array<SavedFilter<TFilters, TTab>> => {
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(storageKey) ?? '[]',
    ) as Array<SavedFilter<TFilters, TTab>>;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item) =>
        Boolean(item?.id) &&
        Boolean(item?.employeeId) &&
        Boolean(item?.name) &&
        tabs.includes(item?.tab) &&
        Boolean(item?.filters),
    );
  } catch {
    return [];
  }
};

export const createSavedFilterId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
