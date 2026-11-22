export interface StatusSelectionResult<T extends string> {
  statuses: T[];
  statusSelectionExplicit: boolean;
}

/**
 * Returns true only when every available status option is present in the selected list.
 */
export const isAllStatusesSelected = <T extends string>(
  selected: readonly T[],
  allOptions: readonly T[],
): boolean =>
  allOptions.length > 0 &&
  allOptions.every((option) => selected.includes(option));

/**
 * Click All when any are off -> press every status.
 * Click All when all are on -> press none ([]).
 */
export const toggleAllStatuses = <T extends string>(
  selected: readonly T[],
  allOptions: readonly T[],
): T[] => {
  if (isAllStatusesSelected(selected, allOptions)) {
    return [];
  }
  return [...allOptions];
};

/**
 * Click one status to press or release it.
 */
export const toggleSingleStatus = <T extends string>(
  selected: readonly T[],
  status: T,
): T[] => {
  if (selected.includes(status)) {
    return selected.filter((item) => item !== status);
  }
  return [...selected, status];
};

/**
 * Match a status against selected list.
 * Empty selection matches nothing (returns false).
 */
export const matchesStatusFilter = <T extends string>(
  status: T,
  selected: readonly T[],
): boolean => {
  if (selected.length === 0) {
    return false;
  }
  return selected.includes(status);
};

/**
 * Summary label key for filter panel summary:
 * - all pressed -> 'all'
 * - none pressed -> 'none'
 * - otherwise -> 'count'
 */
export const getStatusFilterSummaryKey = <T extends string>(
  selected: readonly T[],
  allOptions: readonly T[],
): 'all' | 'none' | 'count' => {
  if (isAllStatusesSelected(selected, allOptions)) {
    return 'all';
  }
  if (selected.length === 0) {
    return 'none';
  }
  return 'count';
};

/**
 * Computes status contribution to active filter count badge:
 * - full set -> 0
 * - empty set -> 1
 * - proper subset:
 *   - 'single' mode (Receipts): 1
 *   - 'per-status' mode (Supplier Order): selected.length
 */
export const getStatusFilterBadgeCount = <T extends string>(
  selected: readonly T[],
  allOptions: readonly T[],
  mode: 'single' | 'per-status' = 'single',
): number => {
  if (isAllStatusesSelected(selected, allOptions)) {
    return 0;
  }
  if (selected.length === 0) {
    return 1;
  }
  return mode === 'per-status' ? selected.length : 1;
};

/**
 * Resolves status list from stored/saved payload handling legacy fallback:
 * - If statusSelectionExplicit is true: explicit list is preserved (including [] as zero rows).
 * - If statusSelectionExplicit is not true:
 *   - Non-empty list is preserved and marked explicit.
 *   - Legacy single status (non-'all') is converted to [status] and marked explicit.
 *   - Empty list, missing, or 'all' defaults to allOptions and marked explicit.
 */
export const resolveStatusSelectionWithLegacyFallback = <T extends string>({
  statuses,
  statusSelectionExplicit,
  allOptions,
  legacySingleStatus,
}: {
  statuses?: unknown;
  statusSelectionExplicit?: unknown;
  allOptions: readonly T[];
  legacySingleStatus?: unknown;
}): StatusSelectionResult<T> => {
  const isOption = (val: unknown): val is T =>
    typeof val === 'string' && allOptions.includes(val as T);

  if (statusSelectionExplicit === true) {
    const explicitStatuses = Array.isArray(statuses)
      ? statuses.filter(isOption)
      : [];
    return {
      statuses: explicitStatuses,
      statusSelectionExplicit: true,
    };
  }

  // Legacy format (no statusSelectionExplicit flag)
  if (Array.isArray(statuses)) {
    const filtered = statuses.filter(isOption);
    if (filtered.length > 0) {
      return {
        statuses: filtered,
        statusSelectionExplicit: true,
      };
    }
    return {
      statuses: [...allOptions],
      statusSelectionExplicit: true,
    };
  }

  if (isOption(legacySingleStatus)) {
    return {
      statuses: [legacySingleStatus],
      statusSelectionExplicit: true,
    };
  }

  return {
    statuses: [...allOptions],
    statusSelectionExplicit: true,
  };
};
