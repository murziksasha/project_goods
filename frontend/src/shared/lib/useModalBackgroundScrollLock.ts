import { useEffect } from 'react';

type ModalBackgroundScrollLockOptions = {
  allowedSelectors: string[];
  lockTableWrap?: boolean;
};

const isInsideAllowedRegion = (
  target: EventTarget | null,
  allowedSelectors: string[],
) => {
  if (!(target instanceof HTMLElement)) return false;
  return allowedSelectors.some((selector) => target.closest(selector));
};

export const useModalBackgroundScrollLock = (
  isActive: boolean,
  options: ModalBackgroundScrollLockOptions,
) => {
  const { allowedSelectors, lockTableWrap = true } = options;

  useEffect(() => {
    if (!isActive) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const tableWraps = lockTableWrap
      ? Array.from(document.querySelectorAll<HTMLElement>('.orders-table-wrap'))
      : [];
    const previousTableWrapOverflows = tableWraps.map(
      (tableWrap) => tableWrap.style.overflow,
    );

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    tableWraps.forEach((tableWrap) => {
      tableWrap.style.overflow = 'hidden';
    });

    const preventBackgroundScroll = (event: WheelEvent | TouchEvent) => {
      if (isInsideAllowedRegion(event.target, allowedSelectors)) return;
      event.preventDefault();
    };

    document.addEventListener('wheel', preventBackgroundScroll, {
      passive: false,
    });
    document.addEventListener('touchmove', preventBackgroundScroll, {
      passive: false,
    });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      tableWraps.forEach((tableWrap, index) => {
        tableWrap.style.overflow = previousTableWrapOverflows[index] ?? '';
      });
      document.removeEventListener('wheel', preventBackgroundScroll);
      document.removeEventListener('touchmove', preventBackgroundScroll);
    };
  }, [allowedSelectors, isActive, lockTableWrap]);
};