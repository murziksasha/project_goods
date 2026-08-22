const DASHBOARD_MAIN_SELECTOR = '.dashboard-main';

export const getDashboardMainScrollBehavior = (
  matchMedia: (query: string) => MediaQueryList = window.matchMedia,
): ScrollBehavior => {
  if (typeof window === 'undefined' || typeof matchMedia !== 'function') {
    return 'auto';
  }

  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'auto';
    }
  } catch {
    return 'smooth';
  }

  return 'smooth';
};

export const scrollDashboardMainToTop = () => {
  const main = document.querySelector<HTMLElement>(DASHBOARD_MAIN_SELECTOR);
  if (!main) return;

  main.scrollTo({
    top: 0,
    behavior: getDashboardMainScrollBehavior(),
  });
};
