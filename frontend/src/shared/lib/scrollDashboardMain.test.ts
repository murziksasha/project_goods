import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDashboardMainScrollBehavior,
  scrollDashboardMainToTop,
} from './scrollDashboardMain';

describe('scrollDashboardMain', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('uses auto behavior when reduced motion is preferred', () => {
    expect(
      getDashboardMainScrollBehavior(
        () => ({ matches: true }) as MediaQueryList,
      ),
    ).toBe('auto');
  });

  it('uses smooth behavior by default', () => {
    expect(
      getDashboardMainScrollBehavior(
        () => ({ matches: false }) as MediaQueryList,
      ),
    ).toBe('smooth');
  });

  it('scrolls dashboard-main to the top', () => {
    const main = document.createElement('section');
    main.className = 'dashboard-main';
    const scrollTo = vi.fn();
    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
    document.body.append(main);

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => ({ matches: false }),
    });

    scrollDashboardMainToTop();

    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('does nothing when dashboard-main is missing', () => {
    expect(() => scrollDashboardMainToTop()).not.toThrow();
  });
});
