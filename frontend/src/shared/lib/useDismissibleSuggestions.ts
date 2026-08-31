import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefCallback,
} from 'react';

type UseDismissibleSuggestionsOptions = {
  query: string;
  isActive: boolean;
};

export const useDismissibleSuggestions = ({
  query,
  isActive,
}: UseDismissibleSuggestionsOptions) => {
  const rootNodeRef = useRef<HTMLElement | null>(null);
  const panelNodeRef = useRef<HTMLElement | null>(null);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);

  const isVisible = isActive && dismissedQuery !== query;

  const rootRef = useCallback<RefCallback<HTMLElement>>((node) => {
    rootNodeRef.current = node;
  }, []);

  const panelRef = useCallback<RefCallback<HTMLElement>>((node) => {
    panelNodeRef.current = node;
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const isInside = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;
      return Boolean(
        rootNodeRef.current?.contains(target) ||
          panelNodeRef.current?.contains(target),
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      if (isInside(event.target)) return;
      setDismissedQuery(query);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setDismissedQuery(query);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isVisible, query]);

  return { rootRef, panelRef, isVisible };
};
