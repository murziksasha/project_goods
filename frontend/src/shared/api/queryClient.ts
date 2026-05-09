import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  products: ['products'] as const,
  sales: ['sales'] as const,
  clientDevices: ['clientDevices'] as const,
  services: ['services'] as const,
  clients: ['clients'] as const,
  catalogProducts: ['catalogProducts'] as const,
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
