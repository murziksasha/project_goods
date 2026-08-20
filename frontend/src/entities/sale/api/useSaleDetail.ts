import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/api/queryClient';
import { getSaleById } from './saleApi';

export const useSaleDetail = (saleId: string | null, enabled = true) =>
  useQuery({
    queryKey: queryKeys.saleDetail(saleId ?? ''),
    queryFn: () => getSaleById(saleId ?? ''),
    enabled: Boolean(enabled && saleId),
    staleTime: 10_000,
  });
