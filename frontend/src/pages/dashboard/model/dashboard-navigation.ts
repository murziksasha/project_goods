import {
  isAccountingTab,
  type AccountingTab,
} from '../../../widgets/dashboard/model/accounting';
import type { CreateOrderTab, OrdersTab, PageKey } from './types';
import {
  getOrdersTabForCreateOrder,
  ordersTabs,
  pageKeys,
} from './types';

export type DashboardLocation = {
  page: PageKey;
  ordersTab: OrdersTab;
  createOrder: CreateOrderTab | null;
  saleId: string | null;
  accountingTab: AccountingTab | null;
};

const resolveOrdersTab = (
  params: URLSearchParams,
  createOrder: CreateOrderTab | null,
): OrdersTab => {
  if (createOrder) {
    return getOrdersTabForCreateOrder(createOrder);
  }

  const ordersTabParam = params.get('ordersTab');
  return ordersTabs.includes(ordersTabParam as OrdersTab)
    ? (ordersTabParam as OrdersTab)
    : 'orders';
};

export const parseDashboardLocation = (
  search: string,
): DashboardLocation => {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  );
  const pageParam = params.get('page');
  const page = pageKeys.includes(pageParam as PageKey)
    ? (pageParam as PageKey)
    : 'home';

  const createOrderParam = params.get('createOrder');
  const createOrder =
    createOrderParam === 'repair' || createOrderParam === 'sale'
      ? createOrderParam
      : null;
  const ordersTab = resolveOrdersTab(params, createOrder);
  const saleId = params.get('saleId')?.trim() || null;
  const accountingTabParam = params.get('accountingTab');
  const accountingTab =
    page === 'accounting' && isAccountingTab(accountingTabParam)
      ? accountingTabParam
      : null;

  return {
    page,
    ordersTab,
    createOrder,
    saleId,
    accountingTab,
  };
};

export const parseDashboardLocationFromWindow = () =>
  parseDashboardLocation(window.location.search);

export const buildDashboardHref = (
  location: Partial<DashboardLocation> & Pick<DashboardLocation, 'page'>,
  baseHref: string = window.location.href,
): string => {
  const url = new URL(baseHref);
  const page = location.page;
  const ordersTab = location.ordersTab ?? 'orders';
  const createOrder = location.createOrder ?? null;
  const saleId = location.saleId ?? null;
  const accountingTab = location.accountingTab ?? null;

  if (page === 'home') {
    url.searchParams.delete('page');
  } else {
    url.searchParams.set('page', page);
  }

  if (page === 'orders') {
    url.searchParams.set('ordersTab', ordersTab);
  } else {
    url.searchParams.delete('ordersTab');
  }

  if (page !== 'accounting') {
    url.searchParams.delete('accountingTab');
  } else if (accountingTab) {
    url.searchParams.set('accountingTab', accountingTab);
  }

  if (page === 'orders' && createOrder) {
    url.searchParams.set('createOrder', createOrder);
  } else {
    url.searchParams.delete('createOrder');
  }

  if (page === 'orders' && saleId && !createOrder) {
    url.searchParams.set('saleId', saleId);
  } else {
    url.searchParams.delete('saleId');
  }

  return `${url.pathname}${url.search}${url.hash}`;
};

export const getDashboardHref = (
  page: PageKey,
  options: {
    ordersTab?: OrdersTab;
    createOrder?: CreateOrderTab;
    saleId?: string;
    accountingTab?: AccountingTab;
  } = {},
) =>
  buildDashboardHref({
    page,
    ordersTab: options.ordersTab,
    createOrder: options.createOrder ?? null,
    saleId: options.saleId ?? null,
    accountingTab: options.accountingTab ?? null,
  });

export const getCurrentDashboardHref = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

export const navigateDashboard = (
  location: Partial<DashboardLocation> & Pick<DashboardLocation, 'page'>,
  options: { replace?: boolean } = {},
) => {
  const href = buildDashboardHref(location);
  const currentHref = getCurrentDashboardHref();

  if (href === currentHref) {
    return;
  }

  if (options.replace) {
    window.history.replaceState(null, '', href);
  } else {
    window.history.pushState(null, '', href);
  }
};

export const getOrderLink = (saleId: string, kind: 'repair' | 'sale') =>
  buildDashboardHref({
    page: 'orders',
    ordersTab: kind === 'sale' ? 'sales' : 'orders',
    createOrder: null,
    saleId,
    accountingTab: null,
  });