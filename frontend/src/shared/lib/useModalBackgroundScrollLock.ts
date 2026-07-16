import { useEffect } from 'react';

type ModalBackgroundScrollLockOptions = {
  allowedSelectors: string[];
  lockTableWrap?: boolean;
};

type ActiveScrollLock = {
  preventBackgroundScroll: (event: WheelEvent | TouchEvent) => void;
};

const activeLocks = new Set<ActiveScrollLock>();

let baseBodyOverflow = '';
let baseDocumentOverflow = '';
let baseTableWrapOverflows: Array<{ element: HTMLElement; overflow: string }> =
  [];
let isBaseCaptured = false;

const isInsideAllowedRegion = (
  target: EventTarget | null,
  allowedSelectors: string[],
) => {
  if (!(target instanceof HTMLElement)) return false;
  return allowedSelectors.some((selector) => target.closest(selector));
};

const applyOverflowLock = (lockTableWrap: boolean) => {
  if (!isBaseCaptured) {
    baseBodyOverflow = document.body.style.overflow;
    baseDocumentOverflow = document.documentElement.style.overflow;
    baseTableWrapOverflows = lockTableWrap
      ? Array.from(
          document.querySelectorAll<HTMLElement>('.orders-table-wrap'),
        ).map((element) => ({
          element,
          overflow: element.style.overflow,
        }))
      : [];
    isBaseCaptured = true;
  }

  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  if (lockTableWrap) {
    document
      .querySelectorAll<HTMLElement>('.orders-table-wrap')
      .forEach((tableWrap) => {
        const alreadyTracked = baseTableWrapOverflows.some(
          (entry) => entry.element === tableWrap,
        );
        if (!alreadyTracked) {
          baseTableWrapOverflows.push({
            element: tableWrap,
            overflow: tableWrap.style.overflow,
          });
        }
        tableWrap.style.overflow = 'hidden';
      });
  }
};

const restoreOverflowIfIdle = () => {
  if (activeLocks.size > 0 || !isBaseCaptured) return;

  document.body.style.overflow = baseBodyOverflow;
  document.documentElement.style.overflow = baseDocumentOverflow;
  baseTableWrapOverflows.forEach(({ element, overflow }) => {
    element.style.overflow = overflow;
  });

  baseBodyOverflow = '';
  baseDocumentOverflow = '';
  baseTableWrapOverflows = [];
  isBaseCaptured = false;
};

const acquireModalBackgroundScrollLock = (options: {
  allowedSelectors: string[];
  lockTableWrap: boolean;
}) => {
  const { allowedSelectors, lockTableWrap } = options;

  const preventBackgroundScroll = (event: WheelEvent | TouchEvent) => {
    if (isInsideAllowedRegion(event.target, allowedSelectors)) return;
    event.preventDefault();
  };

  const lock: ActiveScrollLock = { preventBackgroundScroll };
  activeLocks.add(lock);
  applyOverflowLock(lockTableWrap);

  document.addEventListener('wheel', preventBackgroundScroll, {
    passive: false,
  });
  document.addEventListener('touchmove', preventBackgroundScroll, {
    passive: false,
  });

  return () => {
    activeLocks.delete(lock);
    document.removeEventListener('wheel', preventBackgroundScroll);
    document.removeEventListener('touchmove', preventBackgroundScroll);
    restoreOverflowIfIdle();
  };
};

/** Test helper: reset module lock state between cases. */
export const resetModalBackgroundScrollLockForTests = () => {
  activeLocks.clear();
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  baseBodyOverflow = '';
  baseDocumentOverflow = '';
  baseTableWrapOverflows = [];
  isBaseCaptured = false;
};

export const useModalBackgroundScrollLock = (
  isActive: boolean,
  options: ModalBackgroundScrollLockOptions,
) => {
  const { allowedSelectors, lockTableWrap = true } = options;
  // Content-stable dependency so parent re-renders don't re-acquire locks.
  const selectorsKey = allowedSelectors.join('\0');

  useEffect(() => {
    if (!isActive) return;

    const selectors = selectorsKey.length > 0 ? selectorsKey.split('\0') : [];

    return acquireModalBackgroundScrollLock({
      allowedSelectors: selectors,
      lockTableWrap,
    });
  }, [isActive, lockTableWrap, selectorsKey]);
};
