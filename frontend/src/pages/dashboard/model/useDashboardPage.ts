import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { initialClientForm } from '../../../entities/client/model/forms';
import type { Client, ClientFormValues, ClientHistory, ClientStatus } from '../../../entities/client/model/types';
import {
  createClient,
  deleteClient,
  getClients,
  updateClient,
} from '../../../entities/client/api/clientApi';
import { initialEmployeeForm } from '../../../entities/employee/model/forms';
import type { Employee, EmployeeFormValues } from '../../../entities/employee/model/types';
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
  getProducts,
  updateProduct,
  updateProductModelByName,
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
import type { Sale, SaleFormValues } from '../../../entities/sale/model/types';
import {
  createCatalogProduct,
  deleteCatalogProduct,
  getCatalogProducts,
  updateCatalogProduct,
} from '../../../entities/catalog-product/api/catalogProductApi';
import type {
  CatalogProduct,
  CatalogProductFormValues,
} from '../../../entities/catalog-product/model/types';
import {
  createSale,
  deleteSale,
  getSales,
  updateSale,
} from '../../../entities/sale/api/saleApi';
import type { DemoSeedKind } from '../../../features/demo-data/api/demoApi';
import { queryClient, queryKeys } from '../../../shared/api/queryClient';
import i18n from '../../../shared/i18n/config';
import { initialServiceCatalogForm } from '../../../entities/service-catalog/model/forms';
import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from '../../../entities/service-catalog/model/types';
import {
  archiveServiceCatalogItem,
  createServiceCatalogItem,
  deleteServiceCatalogItem,
  updateServiceCatalogItem,
} from '../../../entities/service-catalog/api/serviceCatalogApi';
import type { AppSettings, AppSettingsFormValues } from '../../../entities/settings/model/types';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import { createDashboardActions } from './dashboard-actions';
import { useDashboardEffects } from './use-dashboard-effects';
import type { StatsPeriod } from '../../../widgets/dashboard/model/sales-analytics';

const productSearchStorageKey = 'project-goods.filter.product-search';
const serviceSearchStorageKey = 'project-goods.filter.service-search';
const clientSearchStorageKey = 'project-goods.filter.client-search';
const clientStatusStorageKey = 'project-goods.filter.client-status';

export const useDashboardPage = (enabled = true, currentEmployee: Employee | null = null) => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [clientDevices, setClientDevices] = useState<ClientDevice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<AppSettingsFormValues>(
    createDefaultSettingsForm,
  );
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('today');
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
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isSuppliersLoading, setIsSuppliersLoading] = useState(true);
  const [isServicesLoading, setIsServicesLoading] = useState(true);
  const [isClientsLoading, setIsClientsLoading] = useState(true);
  const [isSalesLoading, setIsSalesLoading] = useState(true);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true);
  const [isCatalogProductsLoading, setIsCatalogProductsLoading] = useState(true);
  const [isClientHistoryLoading, setIsClientHistoryLoading] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);
  const [isServiceSaving, setIsServiceSaving] = useState(false);
  const [isClientSaving, setIsClientSaving] = useState(false);
  const [isClientImporting, setIsClientImporting] = useState(false);
  const [isClientExporting, setIsClientExporting] = useState(false);
  const [isSaleSaving, setIsSaleSaving] = useState(false);
  const [isEmployeeSaving, setIsEmployeeSaving] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalogProducts });
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
    setIsServicesLoading,
    setIsEmployeesLoading,
    setIsCatalogProductsLoading,
    setIsClientHistoryLoading,
    setError,
    setLastSyncAt,
  });

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
    setAllProducts,
    setCatalogProducts,
    setSuppliers,
    setAllClients,
    setSales,
    setServices,
    setAllEmployees,
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
    setIsExporting,
    setIsSeeding,
    setError,
    setSuccessMessage,
    currentEmployee,
    refreshSales: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sales });
      const nextSales = await queryClient.fetchQuery({
        queryKey: queryKeys.sales,
        queryFn: () => getSales(),
      });
      setSales(nextSales);
      setLastSyncAt(new Date().toISOString());
    },
    refreshProducts: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
      const nextProducts = await queryClient.fetchQuery({
        queryKey: queryKeys.products,
        queryFn: () => getProducts(),
      });
      setAllProducts(nextProducts);
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
      const nextClients = await queryClient.fetchQuery({
        queryKey: queryKeys.clients,
        queryFn: () => getClients(),
      });
      setAllClients(nextClients);
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
      isExporting,
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
        const nextCatalogProducts = await queryClient.fetchQuery({
          queryKey: queryKeys.catalogProducts,
          queryFn: () => getCatalogProducts(),
        });
        setCatalogProducts(nextCatalogProducts);
      },
      eraseAllData: async () => {
        await actions.eraseAllData();
        await queryClient.invalidateQueries({
          queryKey: queryKeys.catalogProducts,
        });
        const nextCatalogProducts = await queryClient.fetchQuery({
          queryKey: queryKeys.catalogProducts,
          queryFn: () => getCatalogProducts(),
        });
        setCatalogProducts(nextCatalogProducts);
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
          await queryClient.invalidateQueries({
            queryKey: queryKeys.catalogProducts,
          });
          const nextCatalogProducts = await queryClient.fetchQuery({
            queryKey: queryKeys.catalogProducts,
            queryFn: () => getCatalogProducts(),
          });
          setCatalogProducts(nextCatalogProducts);
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
          await queryClient.invalidateQueries({
            queryKey: queryKeys.catalogProducts,
          });
          const nextCatalogProducts = await queryClient.fetchQuery({
            queryKey: queryKeys.catalogProducts,
            queryFn: () => getCatalogProducts(),
          });
          setCatalogProducts(nextCatalogProducts);
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
          await queryClient.invalidateQueries({
            queryKey: queryKeys.catalogProducts,
          });
          const nextCatalogProducts = await queryClient.fetchQuery({
            queryKey: queryKeys.catalogProducts,
            queryFn: () => getCatalogProducts(),
          });
          setCatalogProducts(nextCatalogProducts);
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
          const updatedProduct = await updateProductMutation.mutateAsync({
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
          setAllProducts((current) =>
            current.map((item) =>
              item.id === updatedProduct.id ? updatedProduct : item,
            ),
          );
          await queryClient.invalidateQueries({
            queryKey: queryKeys.products,
          });
          const nextProducts = await queryClient.fetchQuery({
            queryKey: queryKeys.products,
            queryFn: () => getProducts(),
          });
          setAllProducts(nextProducts);
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
      setStatsPeriod,
      showError: setError,
      showSuccessMessage: setSuccessMessage,
    },
  };
};
