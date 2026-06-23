import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  products: ['products'] as const,
  sales: ['sales'] as const,
  clientDevices: ['clientDevices'] as const,
  services: ['services'] as const,
  clients: ['clients'] as const,
  catalogProducts: ['catalogProducts'] as const,
  supplierOrders: ['supplierOrders'] as const,
  warehouseSettings: ['warehouseSettings'] as const,
  financeCashboxes: ['financeCashboxes'] as const,
  financeAllCashboxes: ['financeCashboxes', 'all'] as const,
  financeCurrencies: ['financeCurrencies'] as const,
  financeTransactions: ['financeTransactions'] as const,
  financeReport: ['financeReport'] as const,
  financeSupplierOrdersQueue: ['financeSupplierOrdersQueue'] as const,
  financeSettings: ['financeSettings'] as const,
  marketRates: ['marketRates'] as const,
  weatherForecast: ['weatherForecast'] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});
