import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollToTopButton } from './ScrollToTopButton';

const scrollDashboardMainToTopMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/scrollDashboardMain', () => ({
  scrollDashboardMainToTop: () => scrollDashboardMainToTopMock(),
}));

describe('ScrollToTopButton', () => {
  afterEach(() => {
    scrollDashboardMainToTopMock.mockReset();
  });

  it('stays hidden until dashboard-main is scrolled down, then scrolls to top on click', () => {
    const main = document.createElement('section');
    main.className = 'dashboard-main';
    Object.defineProperty(main, 'scrollTop', {
      configurable: true,
      value: 0,
      writable: true,
    });
    document.body.append(main);

    render(<ScrollToTopButton />);

    const button = screen.getByLabelText('Back to top');
    expect(button).not.toHaveClass('is-visible');
    expect(button).toHaveAttribute('aria-hidden', 'true');

    Object.defineProperty(main, 'scrollTop', {
      configurable: true,
      value: 400,
      writable: true,
    });
    fireEvent.scroll(main);

    expect(button).toHaveClass('is-visible');
    expect(button).toHaveAttribute('aria-hidden', 'false');

    fireEvent.click(button);
    expect(scrollDashboardMainToTopMock).toHaveBeenCalledTimes(1);
  });
});
