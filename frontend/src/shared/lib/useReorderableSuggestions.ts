import { useCallback, useEffect, useState } from 'react';
import type React from 'react';

export interface UseReorderableSuggestionsOptions<T> {
  items: T[];
  onSelect: (item: T) => void;
  onReorder?: (reorderedItems: T[]) => void | Promise<void>;
  canReorder?: boolean;
  isVisible: boolean;
}

export function useReorderableSuggestions<T>({
  items,
  onSelect,
  onReorder,
  canReorder = false,
  isVisible,
}: UseReorderableSuggestionsOptions<T>) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isVisible || items.length === 0) {
      setActiveIndex(-1);
      setDraggedIndex(null);
      setDragOverIndex(null);
    } else {
      setActiveIndex((current) => (current >= items.length ? 0 : current));
    }
  }, [isVisible, items.length]);

  const moveItem = useCallback(
    (fromIndex: number, direction: 'up' | 'down') => {
      if (!canReorder || !onReorder) return;
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= items.length) return;

      const nextItems = [...items];
      const [movedItem] = nextItems.splice(fromIndex, 1);
      if (!movedItem) return;
      nextItems.splice(toIndex, 0, movedItem);

      setActiveIndex(toIndex);
      void onReorder(nextItems);
    },
    [canReorder, items, onReorder],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): boolean => {
      if (!isVisible || items.length === 0) return false;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (event.altKey && canReorder && activeIndex >= 0) {
          moveItem(activeIndex, 'down');
        } else {
          setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        }
        return true;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (event.altKey && canReorder && activeIndex >= 0) {
          moveItem(activeIndex, 'up');
        } else {
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
        }
        return true;
      }

      if (event.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < items.length) {
          const item = items[activeIndex];
          if (item) {
            event.preventDefault();
            onSelect(item);
            return true;
          }
        }
      }

      return false;
    },
    [activeIndex, canReorder, isVisible, items, moveItem, onSelect],
  );

  const handleDragStart = useCallback(
    (event: React.DragEvent, index: number) => {
      if (!canReorder) return;
      setDraggedIndex(index);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    },
    [canReorder],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent, index: number) => {
      if (!canReorder || draggedIndex === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [canReorder, dragOverIndex, draggedIndex],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent, targetIndex: number) => {
      if (!canReorder || !onReorder || draggedIndex === null) return;
      event.preventDefault();

      if (draggedIndex !== targetIndex) {
        const nextItems = [...items];
        const [moved] = nextItems.splice(draggedIndex, 1);
        if (moved) {
          nextItems.splice(targetIndex, 0, moved);
          setActiveIndex(targetIndex);
          void onReorder(nextItems);
        }
      }

      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [canReorder, draggedIndex, items, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  return {
    activeIndex,
    setActiveIndex,
    draggedIndex,
    dragOverIndex,
    handleKeyDown,
    moveItem,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}

