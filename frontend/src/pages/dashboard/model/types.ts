export type PageKey =
  | 'home'
  | 'orders'
  | 'clients'
  | 'employees'
  | 'settings'
  | 'accounting'
  | 'catalog'
  | 'warehouse';

export type OrdersTab =
  | 'orders'
  | 'sales'
  | 'supplierOrders'
  | 'supplierInformation';
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

export const ordersTabs: OrdersTab[] = [
  'orders',
  'sales',
  'supplierOrders',
  'supplierInformation',
];
export const ordersTabStorageKey = 'project-goods.orders-tab';

export {
  buildDashboardHref,
  getDashboardHref,
  getOrderLink,
  navigateDashboard,
  parseDashboardLocation,
  parseDashboardLocationFromWindow,
  type DashboardLocation,
} from './dashboard-navigation';

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