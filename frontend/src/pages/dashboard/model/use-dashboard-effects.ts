import { useEffect } from 'react';
import { getClientHistory, getClients } from '../../../entities/client/api/clientApi';
import type { Client, ClientHistory } from '../../../entities/client/model/types';
import { getProducts } from '../../../entities/product/api/productApi';
import type { Product } from '../../../entities/product/model/types';
import { getSales } from '../../../entities/sale/api/saleApi';
import type { Sale } from '../../../entities/sale/model/types';
import { getRequestErrorMessage } from '../../../shared/lib/request';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

type DashboardEffectsParams = {
  selectedClientId: string | null;
  setAllProducts: Setter<Product[]>;
  setAllClients: Setter<Client[]>;
  setSales: Setter<Sale[]>;
  setClientHistory: Setter<ClientHistory | null>;
  setIsProductsLoading: Setter<boolean>;
  setIsClientsLoading: Setter<boolean>;
  setIsSalesLoading: Setter<boolean>;
  setIsClientHistoryLoading: Setter<boolean>;
  setError: Setter<string>;
};

export const useDashboardEffects = ({
  selectedClientId,
  setAllProducts,
  setAllClients,
  setSales,
  setClientHistory,
  setIsProductsLoading,
  setIsClientsLoading,
  setIsSalesLoading,
  setIsClientHistoryLoading,
  setError,
}: DashboardEffectsParams) => {
  useEffect(() => {
    let isActive = true;

    const fetchWorkspaceData = async () => {
      setIsProductsLoading(true);
      setIsClientsLoading(true);

      try {
        const [productsData, clientsData] = await Promise.all([getProducts(), getClients()]);
        if (!isActive) return;
        setAllProducts(productsData);
        setAllClients(clientsData);
      } catch (requestError) {
        if (isActive) {
          setError(getRequestErrorMessage(requestError, 'Failed to load workspace data.'));
        }
      } finally {
        if (isActive) {
          setIsProductsLoading(false);
          setIsClientsLoading(false);
        }
      }
    };

    void fetchWorkspaceData();
    return () => {
      isActive = false;
    };
  }, [setAllClients, setAllProducts, setError, setIsClientsLoading, setIsProductsLoading]);

  useEffect(() => {
    let isActive = true;

    const fetchSalesData = async () => {
      setIsSalesLoading(true);
      try {
        const data = await getSales();
        if (isActive) setSales(data);
      } catch (requestError) {
        if (isActive) setError(getRequestErrorMessage(requestError, 'Failed to load sales.'));
      } finally {
        if (isActive) setIsSalesLoading(false);
      }
    };

    void fetchSalesData();
    return () => {
      isActive = false;
    };
  }, [setError, setIsSalesLoading, setSales]);

  useEffect(() => {
    if (!selectedClientId) return;

    let isActive = true;

    const fetchHistory = async () => {
      setIsClientHistoryLoading(true);
      try {
        const history = await getClientHistory(selectedClientId);
        if (isActive) setClientHistory(history);
      } catch (requestError) {
        if (isActive) {
          setError(getRequestErrorMessage(requestError, 'Failed to load client history.'));
        }
      } finally {
        if (isActive) setIsClientHistoryLoading(false);
      }
    };

    void fetchHistory();
    return () => {
      isActive = false;
    };
  }, [selectedClientId, setClientHistory, setError, setIsClientHistoryLoading]);
};
