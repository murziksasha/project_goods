import { useEffect, useRef, useState } from 'react';

type Metrics = {
  left: number;
  width: number;
  scrollWidth: number;
  visible: boolean;
};

const isVisibleOverflow = (element: HTMLDivElement) => {
  if (element.dataset.globalScrollbar === 'off') return false;

  const rect = element.getBoundingClientRect();
  const intersectsViewport = rect.bottom > 0 && rect.top < window.innerHeight;
  const hasLayout = rect.width > 0 && rect.height > 0;
  const hasOverflow = element.scrollWidth > element.clientWidth + 1;

  return intersectsViewport && hasLayout && hasOverflow;
};

const pickBestTableWrap = () => {
  const candidates = Array.from(
    document.querySelectorAll<HTMLDivElement>(
      '.catalog-table-wrap, .orders-table-wrap, .finance-table-wrap',
    ),
  ).filter(isVisibleOverflow);

  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestScore = -1;

  candidates.forEach((candidate) => {
    const rect = candidate.getBoundingClientRect();
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const score = visibleHeight * rect.width;

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
};

export const GlobalHorizontalScrollbar = () => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const activeWrapRef = useRef<HTMLDivElement | null>(null);
  const syncFromTableRef = useRef(false);
  const syncFromBarRef = useRef(false);
  const [metrics, setMetrics] = useState<Metrics>({
    left: 0,
    width: 0,
    scrollWidth: 0,
    visible: false,
  });

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    let rafId = 0;
    let cleanupActive: (() => void) | null = null;

    const detachActive = () => {
      if (cleanupActive) {
        cleanupActive();
        cleanupActive = null;
      }
      activeWrapRef.current = null;
    };

    const attachActive = (nextWrap: HTMLDivElement) => {
      if (activeWrapRef.current === nextWrap) return;

      detachActive();
      activeWrapRef.current = nextWrap;

      const onTableScroll = () => {
        if (syncFromBarRef.current) return;
        syncFromTableRef.current = true;
        bar.scrollLeft = nextWrap.scrollLeft;
        syncFromTableRef.current = false;
      };

      nextWrap.addEventListener('scroll', onTableScroll, { passive: true });
      cleanupActive = () => {
        nextWrap.removeEventListener('scroll', onTableScroll);
      };
    };

    const sync = () => {
      const bestWrap = pickBestTableWrap();
      if (!bestWrap) {
        detachActive();
        setMetrics((prev) => ({ ...prev, visible: false }));
        return;
      }

      attachActive(bestWrap);

      const rect = bestWrap.getBoundingClientRect();
      setMetrics({
        left: rect.left,
        width: rect.width,
        scrollWidth: bestWrap.scrollWidth,
        visible: true,
      });

      if (!syncFromTableRef.current) {
        syncFromBarRef.current = true;
        bar.scrollLeft = bestWrap.scrollLeft;
        syncFromBarRef.current = false;
      }
    };

    const scheduleSync = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(sync);
    };

    const onBarScroll = () => {
      const activeWrap = activeWrapRef.current;
      if (!activeWrap || syncFromTableRef.current) return;
      syncFromBarRef.current = true;
      activeWrap.scrollLeft = bar.scrollLeft;
      syncFromBarRef.current = false;
    };

    const mutationObserver = new MutationObserver(scheduleSync);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    bar.addEventListener('scroll', onBarScroll, { passive: true });
    window.addEventListener('resize', scheduleSync, { passive: true });
    window.addEventListener('scroll', scheduleSync, { passive: true });
    document.addEventListener('click', scheduleSync, { passive: true });

    scheduleSync();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      detachActive();
      mutationObserver.disconnect();
      bar.removeEventListener('scroll', onBarScroll);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('scroll', scheduleSync);
      document.removeEventListener('click', scheduleSync);
    };
  }, []);

  return (
    <div
      ref={barRef}
      className='global-fixed-h-scrollbar'
      style={{
        left: metrics.left,
        width: metrics.width,
        display: metrics.visible ? 'block' : 'none',
      }}
      aria-hidden='true'
    >
      <div
        className='global-fixed-h-scrollbar-inner'
        style={{ width: metrics.scrollWidth }}
      />
    </div>
  );
};
