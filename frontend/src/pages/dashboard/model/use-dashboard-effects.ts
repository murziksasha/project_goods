import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClientHistory, getClients } from '../../../entities/client/api/clientApi';
import type { Client, ClientHistory } from '../../../entities/client/model/types';
import { getEmployees } from '../../../entities/employee/api/employeeApi';
import type { Employee } from '../../../entities/employee/model/types';
import { getProducts } from '../../../entities/product/api/productApi';
import type { Product } from '../../../entities/product/model/types';
import { getSuppliers } from '../../../entities/supplier/api/supplierApi';
import type { Supplier } from '../../../entities/supplier/model/types';
import { getClientDevices } from '../../../entities/client-device/api/clientDeviceApi';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import { getSales } from '../../../entities/sale/api/saleApi';
import type { Sale } from '../../../entities/sale/model/types';
import { getCatalogProducts } from '../../../entities/catalog-product/api/catalogProductApi';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import { getServiceCatalogItems } from '../../../entities/service-catalog/api/serviceCatalogApi';
import type { ServiceCatalogItem } from '../../../entities/service-catalog/model/types';
import { getSettings } from '../../../entities/settings/api/settingsApi';
import type { AppSettings, AppSettingsFormValues } from '../../../entities/settings/model/types';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import { getRequestErrorMessage } from '../../../shared/lib/request';
import { queryKeys } from '../../../shared/api/queryClient';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

type DashboardEffectsParams = {
  enabled: boolean;
  selectedClientId: string | null;
  setAllProducts: Setter<Product[]>;
  setClientDevices: Setter<ClientDevice[]>;
  setSuppliers: Setter<Supplier[]>;
  setAllClients: Setter<Client[]>;
  setSales: Setter<Sale[]>;
  setCatalogProducts: Setter<CatalogProduct[]>;
  setServices: Setter<ServiceCatalogItem[]>;
  setAllEmployees: Setter<Employee[]>;
  setSettings: Setter<AppSettings | null>;
  setSettingsForm: Setter<AppSettingsFormValues>;
  setClientHistory: Setter<ClientHistory | null>;
  setIsProductsLoading: Setter<boolean>;
  setIsSuppliersLoading: Setter<boolean>;
  setIsClientsLoading: Setter<boolean>;
  setIsSalesLoading: Setter<boolean>;
  setIsCatalogProductsLoading: Setter<boolean>;
  setIsServicesLoading: Setter<boolean>;
  setIsEmployeesLoading: Setter<boolean>;
  setIsClientHistoryLoading: Setter<boolean>;
  setError: Setter<string>;
  setLastSyncAt: Setter<string | null>;
};

export const useDashboardEffects = ({
  enabled,
  selectedClientId,
  setAllProducts,
  setClientDevices,
  setSuppliers,
  setAllClients,
  setSales,
  setCatalogProducts,
  setServices,
  setAllEmployees,
  setSettings,
  setSettingsForm,
  setClientHistory,
  setIsProductsLoading,
  setIsSuppliersLoading,
  setIsClientsLoading,
  setIsSalesLoading,
  setIsCatalogProductsLoading,
  setIsServicesLoading,
  setIsEmployeesLoading,
  setIsClientHistoryLoading,
  setError,
  setLastSyncAt,
}: DashboardEffectsParams) => {
  useEffect(() => {
    if (!enabled) return;

    let isActive = true;

    const fetchWorkspaceData = async () => {
      setIsProductsLoading(true);
      setIsSuppliersLoading(true);
      setIsEmployeesLoading(true);
      setIsClientsLoading(true);
      setIsServicesLoading(true);

      try {
        const [
          suppliersResult,
          employeesResult,
          settingsResult,
        ] =
          await Promise.allSettled([
            getSuppliers(),
            getEmployees(),
            getSettings(),
          ]);
        if (!isActive) return;

        if (suppliersResult.status === 'fulfilled') {
          setSuppliers(suppliersResult.value);
        }
        if (employeesResult.status === 'fulfilled') {
          setAllEmployees(employeesResult.value);
        } else {
          setAllEmployees([]);
        }
        if (settingsResult.status === 'fulfilled') {
          setSettings(settingsResult.value);
          setSettingsForm({
            serviceName: settingsResult.value.serviceName,
            company: settingsResult.value.company,
            companyAddress: settingsResult.value.companyAddress,
            companyId: settingsResult.value.companyId,
            companyIban: settingsResult.value.companyIban,
            printForms: settingsResult.value.printForms,
            orderDefaults: settingsResult.value.orderDefaults,
            numbering: settingsResult.value.numbering,
            financeDefaults: settingsResult.value.financeDefaults,
            notificationSettings: settingsResult.value.notificationSettings,
          });
        } else {
          setSettings(null);
          setSettingsForm(createDefaultSettingsForm());
        }
        setLastSyncAt(new Date().toISOString());
      } finally {
        if (isActive) {
          setIsProductsLoading(false);
          setIsSuppliersLoading(false);
          setIsEmployeesLoading(false);
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
    setClientDevices,
    setSuppliers,
    setError,
    setSettings,
    setSettingsForm,
    setIsClientsLoading,
    setIsEmployeesLoading,
    setIsServicesLoading,
    setIsProductsLoading,
    setIsSuppliersLoading,
    setServices,
  ]);

  const productsQuery = useQuery({
    queryKey: queryKeys.products,
    queryFn: () => getProducts(),
    enabled,
    refetchInterval: enabled ? 30000 : false,
  });
  const clientDevicesQuery = useQuery({
    queryKey: queryKeys.clientDevices,
    queryFn: () => getClientDevices(),
    enabled,
    refetchInterval: enabled ? 30000 : false,
  });
  const salesQuery = useQuery({
    queryKey: queryKeys.sales,
    queryFn: () => getSales(),
    enabled,
    refetchInterval: enabled ? 30000 : false,
  });
  const clientsQuery = useQuery({
    queryKey: queryKeys.clients,
    queryFn: () => getClients(),
    enabled,
    refetchInterval: enabled ? 30000 : false,
  });
  const servicesQuery = useQuery({
    queryKey: queryKeys.services,
    queryFn: () => getServiceCatalogItems(),
    enabled,
    refetchInterval: enabled ? 30000 : false,
  });
  const catalogProductsQuery = useQuery({
    queryKey: queryKeys.catalogProducts,
    queryFn: () => getCatalogProducts(),
    enabled,
    refetchInterval: enabled ? 30000 : false,
  });

  useEffect(() => {
    if (!enabled) return;
    const handleProductsUpdated = () => {
      void productsQuery.refetch();
    };
    window.addEventListener(
      'project-goods:products-updated',
      handleProductsUpdated,
    );
    return () => {
      window.removeEventListener(
        'project-goods:products-updated',
        handleProductsUpdated,
      );
    };
  }, [enabled, productsQuery]);

  useEffect(() => {
    if (!enabled) return;
    setIsProductsLoading(productsQuery.isLoading);
    if (productsQuery.data) {
      setAllProducts(productsQuery.data);
      setLastSyncAt(new Date().toISOString());
    }
    if (productsQuery.error) {
      setError(
        getRequestErrorMessage(productsQuery.error, 'Failed to load products.'),
      );
    }
  }, [
    enabled,
    productsQuery.data,
    productsQuery.error,
    productsQuery.isLoading,
    setAllProducts,
    setError,
    setIsProductsLoading,
    setLastSyncAt,
  ]);

  useEffect(() => {
    if (!enabled) return;
    setIsCatalogProductsLoading(catalogProductsQuery.isLoading);
    if (catalogProductsQuery.data) {
      setCatalogProducts(catalogProductsQuery.data);
      setLastSyncAt(new Date().toISOString());
    }
    if (catalogProductsQuery.error) {
      setError(
        getRequestErrorMessage(
          catalogProductsQuery.error,
          'Failed to load catalog products.',
        ),
      );
    }
  }, [
    enabled,
    catalogProductsQuery.data,
    catalogProductsQuery.error,
    catalogProductsQuery.isLoading,
    setCatalogProducts,
    setError,
    setIsCatalogProductsLoading,
    setLastSyncAt,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (clientDevicesQuery.data) {
      setClientDevices(clientDevicesQuery.data);
      setLastSyncAt(new Date().toISOString());
    }
    if (clientDevicesQuery.error) {
      setError(
        getRequestErrorMessage(
          clientDevicesQuery.error,
          'Failed to load client devices.',
        ),
      );
    }
  }, [
    enabled,
    clientDevicesQuery.data,
    clientDevicesQuery.error,
    setClientDevices,
    setError,
    setLastSyncAt,
  ]);

  useEffect(() => {
    if (!enabled) return;
    setIsSalesLoading(salesQuery.isLoading);
    if (salesQuery.data) {
      setSales(salesQuery.data);
      setLastSyncAt(new Date().toISOString());
    }
    if (salesQuery.error) {
      setError(getRequestErrorMessage(salesQuery.error, 'Failed to load sales.'));
    }
  }, [
    enabled,
    salesQuery.data,
    salesQuery.error,
    salesQuery.isLoading,
    setError,
    setIsSalesLoading,
    setLastSyncAt,
    setSales,
  ]);

  useEffect(() => {
    if (!enabled) return;
    setIsClientsLoading(clientsQuery.isLoading);
    if (clientsQuery.data) {
      setAllClients(clientsQuery.data);
      setLastSyncAt(new Date().toISOString());
    }
    if (clientsQuery.error) {
      setError(
        getRequestErrorMessage(clientsQuery.error, 'Failed to load clients.'),
      );
    }
  }, [
    enabled,
    clientsQuery.data,
    clientsQuery.error,
    clientsQuery.isLoading,
    setAllClients,
    setError,
    setIsClientsLoading,
    setLastSyncAt,
  ]);

  useEffect(() => {
    if (!enabled) return;
    setIsServicesLoading(servicesQuery.isLoading);
    if (servicesQuery.data) {
      setServices(servicesQuery.data);
      setLastSyncAt(new Date().toISOString());
    }
    if (servicesQuery.error) {
      setError(
        getRequestErrorMessage(
          servicesQuery.error,
          'Failed to load services.',
        ),
      );
    }
  }, [
    enabled,
    servicesQuery.data,
    servicesQuery.error,
    servicesQuery.isLoading,
    setError,
    setIsServicesLoading,
    setLastSyncAt,
    setServices,
  ]);

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
