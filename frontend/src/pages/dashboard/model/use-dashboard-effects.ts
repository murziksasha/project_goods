import { useEffect } from 'react';
import { getClientHistory, getClients } from '../../../entities/client/api/clientApi';
import type { Client, ClientHistory } from '../../../entities/client/model/types';
import { getEmployees } from '../../../entities/employee/api/employeeApi';
import type { Employee } from '../../../entities/employee/model/types';
import { getProducts } from '../../../entities/product/api/productApi';
import type { Product } from '../../../entities/product/model/types';
import { getSales } from '../../../entities/sale/api/saleApi';
import type { Sale } from '../../../entities/sale/model/types';
import { getServiceCatalogItems } from '../../../entities/service-catalog/api/serviceCatalogApi';
import type { ServiceCatalogItem } from '../../../entities/service-catalog/model/types';
import { getSettings } from '../../../entities/settings/api/settingsApi';
import type { AppSettings, AppSettingsFormValues } from '../../../entities/settings/model/types';
import { getRequestErrorMessage } from '../../../shared/lib/request';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

type DashboardEffectsParams = {
  enabled: boolean;
  selectedClientId: string | null;
  setAllProducts: Setter<Product[]>;
  setAllClients: Setter<Client[]>;
  setSales: Setter<Sale[]>;
  setServices: Setter<ServiceCatalogItem[]>;
  setAllEmployees: Setter<Employee[]>;
  setSettings: Setter<AppSettings | null>;
  setSettingsForm: Setter<AppSettingsFormValues>;
  setClientHistory: Setter<ClientHistory | null>;
  setIsProductsLoading: Setter<boolean>;
  setIsClientsLoading: Setter<boolean>;
  setIsSalesLoading: Setter<boolean>;
  setIsServicesLoading: Setter<boolean>;
  setIsEmployeesLoading: Setter<boolean>;
  setIsClientHistoryLoading: Setter<boolean>;
  setError: Setter<string>;
};

export const useDashboardEffects = ({
  enabled,
  selectedClientId,
  setAllProducts,
  setAllClients,
  setSales,
  setServices,
  setAllEmployees,
  setSettings,
  setSettingsForm,
  setClientHistory,
  setIsProductsLoading,
  setIsClientsLoading,
  setIsSalesLoading,
  setIsServicesLoading,
  setIsEmployeesLoading,
  setIsClientHistoryLoading,
  setError,
}: DashboardEffectsParams) => {
  useEffect(() => {
    if (!enabled) return;

    let isActive = true;

    const fetchWorkspaceData = async () => {
      setIsProductsLoading(true);
      setIsClientsLoading(true);
      setIsEmployeesLoading(true);
      setIsServicesLoading(true);

      try {
        const [
          productsResult,
          clientsResult,
          employeesResult,
          settingsResult,
          servicesResult,
        ] =
          await Promise.allSettled([
            getProducts(),
            getClients(),
            getEmployees(),
            getSettings(),
            getServiceCatalogItems(),
          ]);
        if (!isActive) return;

        if (productsResult.status === 'fulfilled') {
          setAllProducts(productsResult.value);
        }
        if (clientsResult.status === 'fulfilled') {
          setAllClients(clientsResult.value);
        }
        if (employeesResult.status === 'fulfilled') {
          setAllEmployees(employeesResult.value);
        } else {
          setAllEmployees([]);
        }
        if (settingsResult.status === 'fulfilled') {
          setSettings(settingsResult.value);
          setSettingsForm({ serviceName: settingsResult.value.serviceName });
        } else {
          setSettings(null);
          setSettingsForm({ serviceName: 'Service CRM' });
        }
        if (servicesResult.status === 'fulfilled') {
          setServices(servicesResult.value);
        } else {
          setServices([]);
        }

        if (
          productsResult.status === 'rejected' ||
          clientsResult.status === 'rejected'
        ) {
          const coreError =
            productsResult.status === 'rejected'
              ? productsResult.reason
              : clientsResult.status === 'rejected'
                ? clientsResult.reason
                : new Error('Failed to load workspace data.');
          setError(
            getRequestErrorMessage(
              coreError,
              'Failed to load workspace data.',
            ),
          );
        }
      } finally {
        if (isActive) {
          setIsProductsLoading(false);
          setIsClientsLoading(false);
          setIsEmployeesLoading(false);
          setIsServicesLoading(false);
        }
      }
    };

    void fetchWorkspaceData();
    return () => {
      isActive = false;
    };
  }, [
    enabled,
    setAllClients,
    setAllEmployees,
    setAllProducts,
    setError,
    setSettings,
    setSettingsForm,
    setIsClientsLoading,
    setIsEmployeesLoading,
    setIsServicesLoading,
    setIsProductsLoading,
    setServices,
  ]);

  useEffect(() => {
    if (!enabled) return;

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
  }, [enabled, setError, setIsSalesLoading, setSales]);

  useEffect(() => {
    if (!enabled || !selectedClientId) return;

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
  }, [enabled, selectedClientId, setClientHistory, setError, setIsClientHistoryLoading]);
};
