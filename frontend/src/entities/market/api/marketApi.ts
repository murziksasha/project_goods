import { useQuery } from '@tanstack/react-query';
import type { RateProvider } from '../../settings/model/types';
import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import { queryKeys } from '../../../shared/api/queryClient';

export type ExchangeRateQuote = {
  currency: string;
  provider: RateProvider;
  official?: number;
  buy?: number;
  sell?: number;
  fetchedAt: string;
};

type MarketRatesResponse = {
  quotes: ExchangeRateQuote[];
};

export const getMarketRates = async ({
  providers,
  currencies,
}: {
  providers: RateProvider[];
  currencies: string[];
}) => {
  try {
    const response = await apiClient.get<MarketRatesResponse>('/market/rates', {
      params: {
        providers: providers.join(','),
        currencies: currencies.join(','),
      },
    });
    return response.data.quotes;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const useMarketRatesQuery = ({
  providers,
  currencies,
  enabled = true,
}: {
  providers: RateProvider[];
  currencies: string[];
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: [...queryKeys.marketRates, providers, currencies],
    queryFn: () => getMarketRates({ providers, currencies }),
    enabled: enabled && providers.length > 0 && currencies.length > 0,
    staleTime: 15 * 60 * 1000,
    refetchOnMount: 'always',
  });