import { useCallback, useEffect, useMemo, useState } from 'react';

export const ANALYTICS_COLLAPSED_SECTIONS_STORAGE_PREFIX =
  'project-goods.analytics-collapsed-sections';

export const getAnalyticsCollapsedSectionsStorageKey = (
  employeeId?: string | null,
): string => {
  const normalizedId =
    employeeId && employeeId.trim().length > 0 ? employeeId.trim() : 'anonymous';
  return `${ANALYTICS_COLLAPSED_SECTIONS_STORAGE_PREFIX}.${normalizedId}`;
};

export const readStoredCollapsedSections = (
  employeeId?: string | null,
): string[] => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  const key = getAnalyticsCollapsedSectionsStorageKey(employeeId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    );
  } catch {
    return [];
  }
};

export const writeStoredCollapsedSections = (
  employeeId: string | null | undefined,
  sections: string[],
): void => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  const key = getAnalyticsCollapsedSectionsStorageKey(employeeId);
  try {
    const unique = Array.from(
      new Set(
        sections.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        ),
      ),
    );
    window.localStorage.setItem(key, JSON.stringify(unique));
  } catch {
    // Ignore storage write / quota errors
  }
};

export interface UseAnalyticsCollapsedSectionsReturn {
  collapsedSections: string[];
  isSectionCollapsed: (sectionId: string) => boolean;
  setSectionCollapsed: (sectionId: string, collapsed: boolean) => void;
  toggleSectionCollapse: (sectionId: string) => void;
}

export const useAnalyticsCollapsedSections = (
  employeeId?: string | null,
): UseAnalyticsCollapsedSectionsReturn => {
  const [collapsedSections, setCollapsedSections] = useState<string[]>(() =>
    readStoredCollapsedSections(employeeId),
  );

  useEffect(() => {
    setCollapsedSections(readStoredCollapsedSections(employeeId));
  }, [employeeId]);

  const collapsedSet = useMemo(
    () => new Set(collapsedSections),
    [collapsedSections],
  );

  const isSectionCollapsed = useCallback(
    (sectionId: string): boolean => collapsedSet.has(sectionId),
    [collapsedSet],
  );

  const setSectionCollapsed = useCallback(
    (sectionId: string, collapsed: boolean) => {
      setCollapsedSections((prev) => {
        const nextSet = new Set(prev);
        if (collapsed) {
          nextSet.add(sectionId);
        } else {
          nextSet.delete(sectionId);
        }
        const nextArr = Array.from(nextSet);
        writeStoredCollapsedSections(employeeId, nextArr);
        return nextArr;
      });
    },
    [employeeId],
  );

  const toggleSectionCollapse = useCallback(
    (sectionId: string) => {
      setCollapsedSections((prev) => {
        const nextSet = new Set(prev);
        if (nextSet.has(sectionId)) {
          nextSet.delete(sectionId);
        } else {
          nextSet.add(sectionId);
        }
        const nextArr = Array.from(nextSet);
        writeStoredCollapsedSections(employeeId, nextArr);
        return nextArr;
      });
    },
    [employeeId],
  );

  return {
    collapsedSections,
    isSectionCollapsed,
    setSectionCollapsed,
    toggleSectionCollapse,
  };
};
