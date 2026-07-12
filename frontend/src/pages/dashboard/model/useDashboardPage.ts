import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { initialClientForm } from '../../../entities/client/model/forms';
import type { ClientFormValues, ClientHistory, ClientStatus } from '../../../entities/client/model/types';
import {
  createClient,
  deleteClient,
  updateClient,
  useClientsQuery,
} from '../../../entities/client/api/clientApi';
import { getEmployees } from '../../../entities/employee/api/employeeApi';
import { initialEmployeeForm } from '../../../entities/employee/model/forms';
import type { Employee, EmployeeFormValues } from '../../../entities/employee/model/types';
import { getSuppliers } from '../../../entities/supplier/api/supplierApi';
import { getSettings } from '../../../entities/settings/api/settingsApi';
import {
  filterClientsByQuery,
  filterClientsByStatus,
} from '../../../entities/client/lib/filter-clients';
import { initialProductForm, toProductForm } from '../../../entities/product/model/forms';
import type {
  Product,
  ProductFormValues,
  ProductModelUpdatePayload,
} from '../../../entities/product/model/types';
import { filterProducts } from '../../../entities/product/lib/filter-products';
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  updateProduct,
  updateProductModelByName,
  useProductsQuery,
} from '../../../entities/product/api/productApi';
import type { Supplier } from '../../../entities/supplier/model/types';
import type {
  ClientDevice,
  ClientDeviceFormValues,
} from '../../../entities/client-device/model/types';
import {
  createClientDevice,
  deleteClientDevice,
  getClientDevices,
  updateClientDevice,
} from '../../../entities/client-device/api/clientDeviceApi';
import { initialSaleForm } from '../../../entities/sale/model/forms';
import type { SaleFormValues } from '../../../entities/sale/model/types';
import {
  createCatalogProduct,
  deleteCatalogProduct,
  updateCatalogProduct,
  useCatalogProductsQuery,
} from '../../../entities/catalog-product/api/catalogProductApi';
import type { CatalogProductFormValues } from '../../../entities/catalog-product/model/types';
import {
  createSale,
  deleteSale,
  updateSale,
  useSalesQuery,
} from '../../../entities/sale/api/saleApi';
import type { DemoSeedKind } from '../../../features/demo-data/api/demoApi';
import { queryClient, queryKeys } from '../../../shared/api/queryClient';
import { getRequestErrorMessage } from '../../../shared/lib/request';
import i18n from '../../../shared/i18n/config';
import { initialServiceCatalogForm } from '../../../entities/service-catalog/model/forms';
import type { ServiceCatalogFormValues } from '../../../entities/service-catalog/model/types';
import {
  archiveServiceCatalogItem,
  createServiceCatalogItem,
  deleteServiceCatalogItem,
  updateServiceCatalogItem,
  useServicesQuery,
} from '../../../entities/service-catalog/api/serviceCatalogApi';
import type { AppSettings, AppSettingsFormValues } from '../../../entities/settings/model/types';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import { createDashboardActions } from './dashboard-actions';
import { useDashboardEffects } from './use-dashboard-effects';
import type { StatsPeriod } from '../../../widgets/dashboard/model/sales-analytics';
import {
  getStoredAnalyticsDateRange,
  normalizeAnalyticsDateRange,
  storeAnalyticsDateRange,
  type AnalyticsDateRange,
} from '../../../widgets/dashboard/model/analytics-date-range';

const productSearchStorageKey = 'project-goods.filter.product-search';
const serviceSearchStorageKey = 'project-goods.filter.service-search';
const clientSearchStorageKey = 'project-goods.filter.client-search';
const clientStatusStorageKey = 'project-goods.filter.client-status';

export const useDashboardPage = (enabled = true, currentEmployee: Employee | null = null) => {
  const productsQuery = useProductsQuery(enabled);
  const clientsQuery = useClientsQuery(enabled);
  const salesQuery = useSalesQuery(enabled);
  const catalogProductsQuery = useCatalogProductsQuery(enabled);
  const servicesQuery = useServicesQuery(enabled);

  const allProducts = enabled ? (productsQuery.data ?? []) : [];
  const allClients = enabled ? (clientsQuery.data ?? []) : [];
  const sales = enabled ? (salesQuery.data ?? []) : [];
  const catalogProducts = enabled ? (catalogProductsQuery.data ?? []) : [];
  const services = enabled ? (servicesQuery.data ?? []) : [];

  const [clientDevices, setClientDevices] = useState<ClientDevice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<AppSettingsFormValues>(
    createDefaultSettingsForm,
  );
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('today');
  const [analyticsDateRange, setAnalyticsDateRange] = useState<AnalyticsDateRange | null>(() =>
    getStoredAnalyticsDateRange(),
  );
  const [draftAnalyticsDateRange, setDraftAnalyticsDateRange] = useState<AnalyticsDateRange>(() => ({
    dateFrom: getStoredAnalyticsDateRange()?.dateFrom ?? '',
    dateTo: getStoredAnalyticsDateRange()?.dateTo ?? '',
  }));
  const [isAnalyticsDateFilterOpen, setIsAnalyticsDateFilterOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientHistory, setClientHistory] = useState<ClientHistory | null>(null);
  const [productForm, setProductForm] = useState<ProductFormValues>(initialProductForm);
  const [serviceForm, setServiceForm] =
    useState<ServiceCatalogFormValues>(initialServiceCatalogForm);
  const [clientForm, setClientForm] = useState<ClientFormValues>(initialClientForm);
  const [saleForm, setSaleForm] = useState<SaleFormValues>(initialSaleForm);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormValues>(initialEmployeeForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState(() => window.localStorage.getItem(productSearchStorageKey) ?? '');
  const [serviceSearchQuery, setServiceSearchQuery] = useState(() => window.localStorage.getItem(serviceSearchStorageKey) ?? '');
  const [clientSearchQuery, setClientSearchQuery] = useState(() => window.localStorage.getItem(clientSearchStorageKey) ?? '');
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatus | 'all'>(() => {
    const value = window.localStorage.getItem(clientStatusStorageKey);
    return value === 'new' || value === 'vip' || value === 'opt' || value === 'blacklist' || value === 'ok' || value === 'all'
      ? value
      : 'all';
  });
  const deferredProductSearchQuery = useDeferredValue(productSearchQuery.trim());
  const deferredServiceSearchQuery = useDeferredValue(serviceSearchQuery.trim());
  const deferredClientSearchQuery = useDeferredValue(clientSearchQuery.trim());
  const isProductsLoading = enabled ? productsQuery.isLoading : false;
  const isServicesLoading = enabled ? servicesQuery.isLoading : false;
  const isClientsLoading = enabled ? clientsQuery.isLoading : false;
  const isSalesLoading = enabled ? salesQuery.isLoading : false;
  const isCatalogProductsLoading = enabled ? catalogProductsQuery.isLoading : false;
  const [isSuppliersLoading, setIsSuppliersLoading] = useState(true);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true);
  const [isClientHistoryLoading, setIsClientHistoryLoading] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);
  const [isServiceSaving, setIsServiceSaving] = useState(false);
  const [isClientSaving, setIsClientSaving] = useState(false);
  const [isClientImporting, setIsClientImporting] = useState(false);
  const [isClientExporting, setIsClientExporting] = useState(false);
  const [isSaleSaving, setIsSaleSaving] = useState(false);
  const [isEmployeeSaving, setIsEmployeeSaving] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);

  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const createProductMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
  const updateProductMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: ProductFormValues }) =>
      updateProduct(productId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
  const updateProductModelMutation = useMutation({
    mutationFn: (payload: ProductModelUpdatePayload) =>
      updateProductModelByName(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
  const createSaleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sales });
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
  const updateSaleMutation = useMutation({
    mutationFn: ({ saleId, payload }: { saleId: string; payload: SaleFormValues }) =>
      updateSale(saleId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sales });
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
  const createClientDeviceMutation = useMutation({
    mutationFn: createClientDevice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clientDevices });
    },
  });
  const updateClientDeviceMutation = useMutation({
    mutationFn: ({ deviceId, payload }: { deviceId: string; payload: ClientDeviceFormValues }) =>
      updateClientDevice(deviceId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clientDevices });
    },
  });
  const deleteClientDeviceMutation = useMutation({
    mutationFn: deleteClientDevice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clientDevices });
    },
  });
  const archiveProductMutation = useMutation({
    mutationFn: archiveProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
  const deleteProductMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
  const deleteSaleMutation = useMutation({
    mutationFn: deleteSale,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sales });
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
  const createServiceMutation = useMutation({
    mutationFn: createServiceCatalogItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.services });
    },
  });
  const updateServiceMutation = useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: string; payload: ServiceCatalogFormValues }) =>
      updateServiceCatalogItem(serviceId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.services });
    },
  });
  const deleteServiceMutation = useMutation({
    mutationFn: deleteServiceCatalogItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.services });
    },
  });
  const archiveServiceMutation = useMutation({
    mutationFn: archiveServiceCatalogItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.services });
    },
  });
  const createClientMutation = useMutation({
    mutationFn: createClient,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
  const updateClientMutation = useMutation({
    mutationFn: ({ clientId, payload }: { clientId: string; payload: ClientFormValues }) =>
      updateClient(clientId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
  const deleteClientMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
  const updateCatalogProductMutation = useMutation({
    mutationFn: ({ catalogProductId, payload }: { catalogProductId: string; payload: CatalogProductFormValues }) =>
      updateCatalogProduct(catalogProductId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.catalogProducts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sales }),
        queryClient.invalidateQueries({ queryKey: queryKeys.supplierOrders }),
      ]);
    },
  });
  const createCatalogProductMutation = useMutation({
    mutationFn: createCatalogProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalogProducts });
    },
  });
  const deleteCatalogProductMutation = useMutation({
    mutationFn: deleteCatalogProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalogProducts });
    },
  });

  useDashboardEffects({
    enabled,
    employeeId: currentEmployee?.id ?? null,
    selectedClientId,
    setClientDevices,
    setSuppliers,
    setAllEmployees,
    setSettings,
    setSettingsForm,
    setClientHistory,
    setIsSuppliersLoading,
    setIsEmployeesLoading,
    setIsClientHistoryLoading,
    setError,
    setLastSyncAt,
  });

  useEffect(() => {
    if (!enabled) return;
    if (productsQuery.data) {
      setLastSyncAt(new Date().toISOString());
    }
    if (productsQuery.error) {
      setError(
        getRequestErrorMessage(
          productsQuery.error,
          i18n.t('errors.failedLoadProducts'),
        ),
      );
    }
  }, [enabled, productsQuery.data, productsQuery.error]);

  useEffect(() => {
    if (!enabled) return;
    const handleProductsUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
    };
    window.addEventListener('project-goods:products-updated', handleProductsUpdated);
    return () => {
      window.removeEventListener('project-goods:products-updated', handleProductsUpdated);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (clientsQuery.data) {
      setLastSyncAt(new Date().toISOString());
    }
    if (clientsQuery.error) {
      setError(
        getRequestErrorMessage(clientsQuery.error, i18n.t('errors.failedLoadClients')),
      );
    }
  }, [enabled, clientsQuery.data, clientsQuery.error]);

  useEffect(() => {
    if (!enabled) return;
    if (salesQuery.data) {
      setLastSyncAt(new Date().toISOString());
    }
    if (salesQuery.error) {
      setError(
        getRequestErrorMessage(salesQuery.error, i18n.t('errors.failedLoadSales')),
      );
    }
  }, [enabled, salesQuery.data, salesQuery.error]);

  useEffect(() => {
    if (!enabled) return;
    if (catalogProductsQuery.data) {
      setLastSyncAt(new Date().toISOString());
    }
    if (catalogProductsQuery.error) {
      setError(
        getRequestErrorMessage(
          catalogProductsQuery.error,
          i18n.t('errors.failedLoadCatalogProducts'),
        ),
      );
    }
  }, [enabled, catalogProductsQuery.data, catalogProductsQuery.error]);

  useEffect(() => {
    if (!enabled) return;
    if (servicesQuery.data) {
      setLastSyncAt(new Date().toISOString());
    }
    if (servicesQuery.error) {
      setError(
        getRequestErrorMessage(
          servicesQuery.error,
          i18n.t('errors.failedLoadServices'),
        ),
      );
    }
  }, [enabled, servicesQuery.data, servicesQuery.error]);

  useEffect(() => {
    if (!error && !successMessage) return;

    const notificationTimeout = window.setTimeout(() => {
      setError('');
      setSuccessMessage('');
    }, 4000);

    return () => window.clearTimeout(notificationTimeout);
  }, [error, successMessage]);

  useEffect(() => {
    window.localStorage.setItem(productSearchStorageKey, productSearchQuery);
  }, [productSearchQuery]);

  useEffect(() => {
    window.localStorage.setItem(serviceSearchStorageKey, serviceSearchQuery);
  }, [serviceSearchQuery]);

  useEffect(() => {
    window.localStorage.setItem(clientSearchStorageKey, clientSearchQuery);
  }, [clientSearchQuery]);

  useEffect(() => {
    window.localStorage.setItem(clientStatusStorageKey, clientStatusFilter);
  }, [clientStatusFilter]);

  const products = filterProducts(allProducts, deferredProductSearchQuery);
  const filteredServices = services.filter((service) => {
    const query = deferredServiceSearchQuery.toLowerCase();
    if (!query) return true;

    return [service.name, service.note]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
  const clients = filterClientsByQuery(
    filterClientsByStatus(allClients, clientStatusFilter),
    deferredClientSearchQuery,
  );
  const totalFreeStock = allProducts.reduce(
    (total, product) => total + product.freeQuantity,
    0,
  );
  const actions = createDashboardActions({
    clientDevices,
    allServices: services,
    allClients,
    sales,
    allEmployees,
    settingsForm,
    productForm,
    serviceForm,
    clientForm,
    saleForm,
    employeeForm,
    editingProductId,
    editingServiceId,
    editingClientId,
    editingSaleId,
    editingEmployeeId,
    selectedClientId,
    setSettings,
    setSettingsForm,
    setSelectedClientId,
    setClientHistory,
    setProductForm,
    setServiceForm,
    setClientForm,
    setSaleForm,
    setEmployeeForm,
    setEditingProductId,
    setEditingServiceId,
    setEditingClientId,
    setEditingSaleId,
    setEditingEmployeeId,
    setProductSearchQuery,
    setServiceSearchQuery,
    setClientSearchQuery,
    setClientStatusFilter,
    setIsProductSaving,
    setIsServiceSaving,
    setIsClientSaving,
    setIsClientImporting,
    setIsClientExporting,
    setIsSaleSaving,
    setIsEmployeeSaving,
    setIsSettingsSaving,
    setIsSeeding,
    setError,
    setSuccessMessage,
    currentEmployee,
    refreshSales: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sales });
      setLastSyncAt(new Date().toISOString());
    },
    refreshProducts: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
      setLastSyncAt(new Date().toISOString());
    },
    refreshClientDevices: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clientDevices,
      });
      const nextDevices = await queryClient.fetchQuery({
        queryKey: queryKeys.clientDevices,
        queryFn: () => getClientDevices(),
      });
      setClientDevices(nextDevices);
      setLastSyncAt(new Date().toISOString());
    },
    refreshClients: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients });
      setLastSyncAt(new Date().toISOString());
    },
    refreshServices: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.services });
      setLastSyncAt(new Date().toISOString());
    },
    refreshSuppliers: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
      const nextSuppliers = await queryClient.fetchQuery({
        queryKey: queryKeys.suppliers,
        queryFn: () => getSuppliers(),
      });
      setSuppliers(nextSuppliers);
      setLastSyncAt(new Date().toISOString());
    },
    refreshEmployees: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.employees });
      const nextEmployees = await queryClient.fetchQuery({
        queryKey: queryKeys.employees,
        queryFn: () => getEmployees(),
      });
      setAllEmployees(nextEmployees);
      setLastSyncAt(new Date().toISOString());
    },
    refreshSettings: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      const nextSettings = await queryClient.fetchQuery({
        queryKey: queryKeys.settings,
        queryFn: getSettings,
      });
      setSettings(nextSettings);
      setLastSyncAt(new Date().toISOString());
    },
    mutateCreateProduct: async (payload) => createProductMutation.mutateAsync(payload),
    mutateUpdateProduct: async (productId, payload) =>
      updateProductMutation.mutateAsync({ productId, payload }),
    mutateUpdateProductModel: async (payload) =>
      updateProductModelMutation.mutateAsync(payload),
    mutateCreateSale: async (payload) => createSaleMutation.mutateAsync(payload),
    mutateUpdateSale: async (saleId, payload) =>
      updateSaleMutation.mutateAsync({ saleId, payload }),
    mutateCreateClientDevice: async (payload) =>
      createClientDeviceMutation.mutateAsync(payload),
    mutateUpdateClientDevice: async (deviceId, payload) =>
      updateClientDeviceMutation.mutateAsync({ deviceId, payload }),
    mutateDeleteClientDevice: async (deviceId) =>
      deleteClientDeviceMutation.mutateAsync(deviceId),
    mutateArchiveProduct: async (productId) =>
      archiveProductMutation.mutateAsync(productId),
    mutateDeleteProduct: async (productId) =>
      deleteProductMutation.mutateAsync(productId),
    mutateDeleteSale: async (saleId) =>
      deleteSaleMutation.mutateAsync(saleId),
    mutateCreateService: async (payload) =>
      createServiceMutation.mutateAsync(payload),
    mutateUpdateService: async (serviceId, payload) =>
      updateServiceMutation.mutateAsync({ serviceId, payload }),
    mutateDeleteService: async (serviceId) =>
      deleteServiceMutation.mutateAsync(serviceId),
    mutateArchiveService: async (serviceId) =>
      archiveServiceMutation.mutateAsync(serviceId),
    mutateCreateClient: async (payload) =>
      createClientMutation.mutateAsync(payload),
    mutateUpdateClient: async (clientId, payload) =>
      updateClientMutation.mutateAsync({ clientId, payload }),
    mutateDeleteClient: async (clientId) =>
      deleteClientMutation.mutateAsync(clientId),
  });

  return {
    state: {
      allProducts: enabled ? allProducts : [],
      clientDevices: enabled ? clientDevices : [],
      catalogProducts: enabled ? catalogProducts : [],
      suppliers: enabled ? suppliers : [],
      allClients: enabled ? allClients : [],
      sales: enabled ? sales : [],
      services: enabled ? filteredServices : [],
      allEmployees: enabled ? allEmployees : [],
      settings: enabled ? settings : null,
      settingsForm: enabled ? settingsForm : createDefaultSettingsForm(),
      statsPeriod,
      products: enabled ? products : [],
      clients: enabled ? clients : [],
      clientHistory: enabled ? clientHistory : null,
      selectedClientId,
      productForm,
      serviceForm,
      clientForm,
      saleForm,
      employeeForm,
      editingProductId,
      editingServiceId,
      editingClientId,
      editingSaleId,
      editingEmployeeId,
      productSearchQuery,
      serviceSearchQuery,
      clientSearchQuery,
      clientStatusFilter,
      deferredProductSearchQuery,
      deferredServiceSearchQuery,
      deferredClientSearchQuery,
      totalFreeStock: enabled ? totalFreeStock : 0,
      isProductsLoading: enabled ? isProductsLoading : false,
      isSuppliersLoading: enabled ? isSuppliersLoading : false,
      isServicesLoading: enabled ? isServicesLoading : false,
      isClientsLoading: enabled ? isClientsLoading : false,
      isSalesLoading: enabled ? isSalesLoading : false,
      isEmployeesLoading: enabled ? isEmployeesLoading : false,
      isCatalogProductsLoading: enabled ? isCatalogProductsLoading : false,
      isClientHistoryLoading: enabled ? isClientHistoryLoading : false,
      isProductSaving,
      isServiceSaving,
      isClientSaving,
      isClientImporting,
      isClientExporting,
      isSaleSaving,
      isEmployeeSaving,
      isSettingsSaving,
      analyticsDateRange,
      draftAnalyticsDateRange,
      isAnalyticsDateFilterOpen,
      isSeeding,
      error,
      successMessage,
      lastSyncAt,
    },
    actions: {
      ...actions,
      seedDemoData: async (kind: DemoSeedKind = 'all') => {
        await actions.seedDemoData(kind);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.catalogProducts,
        });
      },
      eraseAllData: async () => {
        await actions.eraseAllData();
        await queryClient.invalidateQueries({
          queryKey: queryKeys.catalogProducts,
        });
      },
      updateCatalogProductCard: async (
        catalogProductId: string,
        payload: CatalogProductFormValues,
      ) => {
        try {
          await updateCatalogProductMutation.mutateAsync({
            catalogProductId,
            payload,
          });
          setLastSyncAt(new Date().toISOString());
          setSuccessMessage(i18n.t('dashboard.actions.success.catalogProductUpdated'));
          return true;
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : i18n.t('dashboard.actions.errors.failedUpdateCatalogProduct'),
          );
          return false;
        }
      },
      createCatalogProductCard: async (payload: CatalogProductFormValues) => {
        try {
          await createCatalogProductMutation.mutateAsync(payload);
          setLastSyncAt(new Date().toISOString());
          setSuccessMessage(i18n.t('dashboard.actions.success.catalogProductCreated'));
          return true;
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : i18n.t('dashboard.actions.errors.failedCreateCatalogProduct'),
          );
          return false;
        }
      },
      deleteCatalogProductCard: async (catalogProductId: string) => {
        try {
          await deleteCatalogProductMutation.mutateAsync(catalogProductId);
          setLastSyncAt(new Date().toISOString());
          setSuccessMessage(i18n.t('dashboard.actions.success.catalogProductRemoved'));
          return true;
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : i18n.t('dashboard.actions.errors.failedRemoveCatalogProduct'),
          );
          return false;
        }
      },
      transferProduct: async (
        product: Product,
        target: { warehouseId: string; locationId: string; note: string },
      ) => {
        setIsProductSaving(true);
        setError('');
        setSuccessMessage('');

        try {
          await updateProductMutation.mutateAsync({
            productId: product.id,
            payload: {
              ...toProductForm(product),
              warehouseId: target.warehouseId,
              locationId: target.locationId,
              note: target.note
                ? [
                    product.note,
                    i18n.t('dashboard.actions.notes.transferNote', {
                      note: target.note,
                    }),
                  ]
                    .filter(Boolean)
                    .join('\n')
                : product.note,
            },
          });
          setLastSyncAt(new Date().toISOString());
          setSuccessMessage(i18n.t('dashboard.actions.success.productTransferred'));
          return true;
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : i18n.t('dashboard.actions.errors.failedTransferProduct'),
          );
          return false;
        } finally {
          setIsProductSaving(false);
        }
      },
      setStatsPeriod: (value: StatsPeriod) => {
        setStatsPeriod(value);
        setAnalyticsDateRange(null);
        storeAnalyticsDateRange(null);
        setDraftAnalyticsDateRange({ dateFrom: '', dateTo: '' });
      },
      setDraftAnalyticsDateRange,
      setIsAnalyticsDateFilterOpen,
      applyAnalyticsDateRange: () => {
        const normalized = normalizeAnalyticsDateRange(draftAnalyticsDateRange);
        setAnalyticsDateRange(normalized);
        storeAnalyticsDateRange(normalized);
        setIsAnalyticsDateFilterOpen(false);
      },
      clearAnalyticsDateRange: () => {
        setAnalyticsDateRange(null);
        setDraftAnalyticsDateRange({ dateFrom: '', dateTo: '' });
        storeAnalyticsDateRange(null);
        setIsAnalyticsDateFilterOpen(false);
      },
      showError: setError,
      showSuccessMessage: setSuccessMessage,
    },
  };
};
