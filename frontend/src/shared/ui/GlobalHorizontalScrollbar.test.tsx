import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalHorizontalScrollbar } from './GlobalHorizontalScrollbar';

describe('GlobalHorizontalScrollbar', () => {
  let mockRaf: ReturnType<typeof vi.spyOn>;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mockRaf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });
  });

  afterEach(() => {
    mockRaf.mockRestore();
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    }
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const createTableWrap = (
    className: string,
    options?: {
      left?: number;
      top?: number;
      bottom?: number;
      width?: number;
      height?: number;
      scrollWidth?: number;
      clientWidth?: number;
      scrollLeft?: number;
      globalScrollbar?: string;
    },
  ) => {
    const el = document.createElement('div');
    el.className = className;
    if (options?.globalScrollbar) {
      el.dataset.globalScrollbar = options.globalScrollbar;
    }

    const left = options?.left ?? 20;
    const top = options?.top ?? 50;
    const width = options?.width ?? 600;
    const height = options?.height ?? 300;
    const bottom = options?.bottom ?? top + height;
    const scrollWidth = options?.scrollWidth ?? 1000;
    const clientWidth = options?.clientWidth ?? 600;
    let scrollLeft = options?.scrollLeft ?? 0;

    Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left,
        top,
        bottom,
        width,
        height,
        right: left + width,
      }),
    });

    Object.defineProperty(el, 'scrollWidth', {
      configurable: true,
      get: () => scrollWidth,
    });
    Object.defineProperty(el, 'clientWidth', {
      configurable: true,
      get: () => clientWidth,
    });
    Object.defineProperty(el, 'scrollLeft', {
      configurable: true,
      get: () => scrollLeft,
      set: (val: number) => {
        scrollLeft = val;
      },
    });

    document.body.appendChild(el);
    return el;
  };

  it('renders hidden by default when no table wrap element exists', () => {
    const { container } = render(<GlobalHorizontalScrollbar />);
    const bar = container.querySelector(
      '.global-fixed-h-scrollbar',
    ) as HTMLElement;

    expect(bar).toBeInTheDocument();
    expect(bar.style.display).toBe('none');
  });

  it('renders visible and syncs layout when an overflowing table wrap is present', () => {
    createTableWrap('catalog-table-wrap', {
      left: 30,
      width: 500,
      scrollWidth: 1200,
      clientWidth: 500,
      scrollLeft: 80,
    });

    const { container } = render(<GlobalHorizontalScrollbar />);
    const bar = container.querySelector(
      '.global-fixed-h-scrollbar',
    ) as HTMLElement;
    const inner = container.querySelector(
      '.global-fixed-h-scrollbar-inner',
    ) as HTMLElement;

    expect(bar.style.display).toBe('block');
    expect(bar.style.left).toBe('30px');
    expect(bar.style.width).toBe('500px');
    expect(inner.style.width).toBe('1200px');
    expect(bar.scrollLeft).toBe(80);
  });

  it('syncs scroll bidirectionally between table and scrollbar', () => {
    const table = createTableWrap('orders-table-wrap', {
      left: 10,
      width: 400,
      scrollWidth: 1000,
      clientWidth: 400,
      scrollLeft: 0,
    });

    const { container } = render(<GlobalHorizontalScrollbar />);
    const bar = container.querySelector(
      '.global-fixed-h-scrollbar',
    ) as HTMLElement;

    // Table scrolls -> scrollbar updates
    table.scrollLeft = 150;
    fireEvent.scroll(table);
    expect(bar.scrollLeft).toBe(150);

    // Scrollbar scrolls -> table updates
    bar.scrollLeft = 320;
    fireEvent.scroll(bar);
    expect(table.scrollLeft).toBe(320);
  });

  it('ignores table wrap when data-global-scrollbar="off"', () => {
    createTableWrap('catalog-table-wrap', {
      globalScrollbar: 'off',
      scrollWidth: 1200,
      clientWidth: 500,
    });

    const { container } = render(<GlobalHorizontalScrollbar />);
    const bar = container.querySelector(
      '.global-fixed-h-scrollbar',
    ) as HTMLElement;

    expect(bar.style.display).toBe('none');
  });

  it('ignores table wrap when there is no horizontal overflow', () => {
    createTableWrap('finance-table-wrap', {
      scrollWidth: 500,
      clientWidth: 500,
    });

    const { container } = render(<GlobalHorizontalScrollbar />);
    const bar = container.querySelector(
      '.global-fixed-h-scrollbar',
    ) as HTMLElement;

    expect(bar.style.display).toBe('none');
  });

  it('ignores table wrap outside the viewport', () => {
    createTableWrap('catalog-table-wrap', {
      top: -400,
      bottom: -10,
      scrollWidth: 1200,
      clientWidth: 500,
    });

    const { container } = render(<GlobalHorizontalScrollbar />);
    const bar = container.querySelector(
      '.global-fixed-h-scrollbar',
    ) as HTMLElement;

    expect(bar.style.display).toBe('none');
  });

  it('hides scrollbar on small screens or coarse pointer', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('(max-width: 1024px)'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    createTableWrap('catalog-table-wrap', {
      scrollWidth: 1200,
      clientWidth: 500,
    });

    const { container } = render(<GlobalHorizontalScrollbar />);
    const bar = container.querySelector(
      '.global-fixed-h-scrollbar',
    ) as HTMLElement;

    expect(bar.style.display).toBe('none');
  });

  it('picks candidate with largest visible area when multiple wraps exist', () => {
    // Smaller visible wrap
    createTableWrap('orders-table-wrap', {
      left: 10,
      top: 50,
      width: 300,
      height: 100,
      scrollWidth: 1000,
      clientWidth: 300,
    });

    // Larger visible wrap
    createTableWrap('catalog-table-wrap', {
      left: 50,
      top: 100,
      width: 800,
      height: 400,
      scrollWidth: 1500,
      clientWidth: 800,
    });

    const { container } = render(<GlobalHorizontalScrollbar />);
    const bar = container.querySelector(
      '.global-fixed-h-scrollbar',
    ) as HTMLElement;

    expect(bar.style.left).toBe('50px');
    expect(bar.style.width).toBe('800px');
  });

  it('updates when window resize or click occurs and cleans up on unmount', () => {
    createTableWrap('orders-table-wrap', {
      left: 10,
      width: 400,
      scrollWidth: 1000,
      clientWidth: 400,
    });

    const { container, unmount } = render(<GlobalHorizontalScrollbar />);
    const bar = container.querySelector(
      '.global-fixed-h-scrollbar',
    ) as HTMLElement;
    expect(bar.style.display).toBe('block');

    // Trigger window events
    fireEvent(window, new Event('resize'));
    fireEvent(window, new Event('scroll'));
    fireEvent(document, new Event('click'));

    expect(bar.style.display).toBe('block');

    // Unmount safely
    expect(() => unmount()).not.toThrow();
  });
});
