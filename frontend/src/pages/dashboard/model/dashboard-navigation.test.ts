import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDashboardHref,
  getDashboardHref,
  navigateDashboard,
  parseDashboardLocation,
} from './dashboard-navigation';

describe('dashboard-navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('parses and builds a round-trip location', () => {
    window.history.replaceState(
      null,
      '',
      '/?page=orders&ordersTab=sales&saleId=sale-1',
    );

    expect(parseDashboardLocation(window.location.search)).toEqual({
      page: 'orders',
      ordersTab: 'sales',
      createOrder: null,
      saleId: 'sale-1',
      accountingTab: null,
      clientCard: null,
    });

    expect(
      buildDashboardHref({
        page: 'orders',
        ordersTab: 'sales',
        createOrder: null,
        saleId: 'sale-1',
        accountingTab: null,
        clientCard: null,
      }),
    ).toBe('/?page=orders&ordersTab=sales&saleId=sale-1');
  });

  it('derives orders tab from createOrder when ordersTab is absent', () => {
    expect(
      parseDashboardLocation('?page=orders&createOrder=sale'),
    ).toEqual({
      page: 'orders',
      ordersTab: 'sales',
      createOrder: 'sale',
      saleId: null,
      accountingTab: null,
      clientCard: null,
    });
  });

  it('keeps accounting tab only on the accounting page', () => {
    expect(
      parseDashboardLocation('?page=accounting&accountingTab=reports'),
    ).toEqual({
      page: 'accounting',
      ordersTab: 'orders',
      createOrder: null,
      saleId: null,
      accountingTab: 'reports',
      clientCard: null,
    });

    expect(
      parseDashboardLocation('?page=accounting&accountingTab=information'),
    ).toEqual({
      page: 'accounting',
      ordersTab: 'orders',
      createOrder: null,
      saleId: null,
      accountingTab: 'information',
      clientCard: null,
    });

    expect(
      buildDashboardHref({
        page: 'clients',
        ordersTab: 'orders',
        createOrder: null,
        saleId: null,
        accountingTab: 'reports',
      }),
    ).toBe('/?page=clients');
  });

  it('maps legacy page=kanban to orders tab kanban', () => {
    expect(parseDashboardLocation('?page=kanban&saleId=sale-9')).toEqual({
      page: 'orders',
      ordersTab: 'kanban',
      createOrder: null,
      saleId: 'sale-9',
      accountingTab: null,
      clientCard: null,
    });

    expect(
      buildDashboardHref({
        page: 'kanban',
        ordersTab: 'orders',
        createOrder: null,
        saleId: 'sale-9',
        accountingTab: null,
        clientCard: null,
      }),
    ).toBe('/?page=orders&ordersTab=kanban&saleId=sale-9');
  });

  it('keeps clientCard on the orders page beside saleId or createOrder', () => {
    expect(
      parseDashboardLocation(
        '?page=orders&ordersTab=orders&saleId=sale-2&clientCard=client-2',
      ),
    ).toEqual({
      page: 'orders',
      ordersTab: 'orders',
      createOrder: null,
      saleId: 'sale-2',
      accountingTab: null,
      clientCard: 'client-2',
    });

    expect(
      parseDashboardLocation(
        '?page=orders&ordersTab=sales&createOrder=sale&clientCard=client-3',
      ).clientCard,
    ).toBe('client-3');

    expect(
      parseDashboardLocation('?page=clients&clientCard=client-4').clientCard,
    ).toBeNull();

    expect(
      buildDashboardHref({
        page: 'orders',
        ordersTab: 'sales',
        createOrder: 'sale',
        saleId: 'sale-9',
        accountingTab: null,
        clientCard: 'client-3',
      }),
    ).toBe(
      '/?page=orders&ordersTab=sales&createOrder=sale&clientCard=client-3',
    );

    expect(
      buildDashboardHref({
        page: 'clients',
        ordersTab: 'orders',
        createOrder: null,
        saleId: null,
        accountingTab: null,
        clientCard: 'client-4',
      }),
    ).toBe('/?page=clients');
  });

  it('builds sidebar hrefs through getDashboardHref', () => {
    expect(getDashboardHref('home')).toBe('/');
    expect(
      getDashboardHref('orders', {
        ordersTab: 'sales',
        createOrder: 'sale',
      }),
    ).toBe('/?page=orders&ordersTab=sales&createOrder=sale');
  });

  it('uses pushState by default and replaceState when requested', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');

    navigateDashboard({ page: 'clients' });
    expect(pushState).toHaveBeenCalledWith(
      null,
      '',
      '/?page=clients',
    );

    pushState.mockClear();
    replaceState.mockClear();

    navigateDashboard({ page: 'catalog' }, { replace: true });
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/?page=catalog',
    );
  });

  it('skips history updates when the href is unchanged', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');

    window.history.replaceState(null, '', '/?page=clients');
    pushState.mockClear();
    replaceState.mockClear();

    navigateDashboard({ page: 'clients' });

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });
});