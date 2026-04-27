export type PageKey =
  | 'home'
  | 'orders'
  | 'clients'
  | 'employees'
  | 'settings'
  | 'accounting'
  | 'catalog'
  | 'warehouse';

export type OrdersTab = 'orders' | 'sales';
export type CreateOrderTab = 'repair' | 'sale';

export const pageKeys: PageKey[] = [
  'home',
  'orders',
  'clients',
  'employees',
  'settings',
  'accounting',
  'catalog',
  'warehouse',
];

export const ordersTabs: OrdersTab[] = ['orders', 'sales'];
export const ordersTabStorageKey = 'project-goods.orders-tab';

export const getPageFromUrl = (): PageKey => {
  const page = new URLSearchParams(window.location.search).get(
    'page',
  );

  return pageKeys.includes(page as PageKey)
    ? (page as PageKey)
    : 'home';
};

export const getOrdersTabFromUrl = (): OrdersTab | null => {
  const tab = new URLSearchParams(window.location.search).get(
    'ordersTab',
  );

  return ordersTabs.includes(tab as OrdersTab)
    ? (tab as OrdersTab)
    : null;
};

export const getCreateOrderFromUrl = (): CreateOrderTab | null => {
  const tab = new URLSearchParams(window.location.search).get(
    'createOrder',
  );

  return tab === 'repair' || tab === 'sale' ? tab : null;
};

export const getStoredOrdersTab = (): OrdersTab => {
  const tab = window.localStorage.getItem(ordersTabStorageKey);

  return ordersTabs.includes(tab as OrdersTab)
    ? (tab as OrdersTab)
    : 'orders';
};

export const getOrdersTabForCreateOrder = (
  tab: CreateOrderTab,
): OrdersTab => (tab === 'sale' ? 'sales' : 'orders');

export const getCreateOrderForOrdersTab = (
  tab: OrdersTab,
): CreateOrderTab => (tab === 'sales' ? 'sale' : 'repair');

export const getDashboardHref = (
  page: PageKey,
  options: {
    ordersTab?: OrdersTab;
    createOrder?: CreateOrderTab;
  } = {},
) => {
  const url = new URL(window.location.href);

  if (page === 'home') {
    url.searchParams.delete('page');
  } else {
    url.searchParams.set('page', page);
  }

  if (page === 'orders') {
    url.searchParams.set('ordersTab', options.ordersTab ?? 'orders');
  } else {
    url.searchParams.delete('ordersTab');
  }

  if (page === 'orders' && options.createOrder) {
    url.searchParams.set('createOrder', options.createOrder);
  } else {
    url.searchParams.delete('createOrder');
  }

  return `${url.pathname}${url.search}${url.hash}`;
};

export const setDashboardUrl = (
  page: PageKey,
  ordersTab: OrdersTab,
  createOrder: CreateOrderTab | null,
) => {
  window.history.replaceState(
    null,
    '',
    getDashboardHref(page, {
      ordersTab,
      createOrder: createOrder ?? undefined,
    }),
  );
};
