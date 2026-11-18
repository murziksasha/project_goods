import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOrderLink } from '../../../../pages/dashboard/model/dashboard-navigation';
import { clearClientOrderTabs, openClientOrderTab } from './client-order-tab';

type FakeTab = Window & { closed: boolean; focus: ReturnType<typeof vi.fn> };

const fakeTab = (): FakeTab => {
  const tab = {
    closed: false,
    opener: window,
    focus: vi.fn(),
  };
  return tab as unknown as FakeTab;
};

afterEach(() => {
  clearClientOrderTabs();
  vi.restoreAllMocks();
});

describe('openClientOrderTab', () => {
  it('opens getOrderLink once per id and focuses that tab on the next plain open', () => {
    const first = fakeTab();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(first);

    openClientOrderTab('sale-repair-1', 'repair');
    openClientOrderTab('sale-repair-1', 'repair');

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      getOrderLink('sale-repair-1', 'repair'),
      '_blank',
    );
    expect(first.opener).toBeNull();
    expect(first.focus).toHaveBeenCalledTimes(1);
  });

  it('opens a different id in its own tab', () => {
    const repair = fakeTab();
    const sale = fakeTab();
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValueOnce(repair)
      .mockReturnValueOnce(sale);

    openClientOrderTab('sale-repair-1', 'repair');
    openClientOrderTab('sale-sale-1', 'sale');
    openClientOrderTab('sale-repair-1', 'repair');

    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(openSpy).toHaveBeenNthCalledWith(
      2,
      getOrderLink('sale-sale-1', 'sale'),
      '_blank',
    );
    expect(repair.focus).toHaveBeenCalledTimes(1);
    expect(sale.focus).not.toHaveBeenCalled();
  });

  it('opens a new tab after the remembered one is closed', () => {
    const first = fakeTab();
    const second = fakeTab();
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    openClientOrderTab('sale-repair-1', 'repair');
    first.closed = true;
    openClientOrderTab('sale-repair-1', 'repair');

    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(first.focus).not.toHaveBeenCalled();
    expect(second.opener).toBeNull();
  });

  it('does not remember a blocked popup', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    openClientOrderTab('sale-repair-1', 'repair');
    openClientOrderTab('sale-repair-1', 'repair');

    expect(openSpy).toHaveBeenCalledTimes(2);
  });
});
