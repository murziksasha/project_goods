import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { initialClientForm } from '../../../entities/client/model/forms';
import type { Client, ClientFormValues, ClientHistory, ClientStatus } from '../../../entities/client/model/types';
import {
  createClient,
  deleteClient,
  updateClient,
} from '../../../entities/client/api/clientApi';
import { initialEmployeeForm } from '../../../entities/employee/model/forms';
import type { Employee, EmployeeFormValues } from '../../../entities/employee/model/types';
import {
  filterClientsByQuery,
  filterClientsByStatus,
} from '../../../entities/client/lib/filter-clients';
import { initialProductForm } from '../../../entities/product/model/forms';
import type { Product, ProductFormValues } from '../../../entities/product/model/types';
import { filterProducts } from '../../../entities/product/lib/filter-products';
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
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
  createSale,
  deleteSale,
  getSales,
  updateSale,
} from '../../../entities/sale/api/saleApi';
import { queryClient, queryKeys } from '../../../shared/api/queryClient';
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
import { createDashboardActions } from './dashboard-actions';
import { useDashboardEffects } from './use-dashboard-effects';
import type { StatsPeriod } from '../../../widgets/dashboard/model/sales-analytics';

export const useDashboardPage = (enabled = true, currentEmployee: Employee | null = null) => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [clientDevices, setClientDevices] = useState<ClientDevice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<AppSettingsFormValues>({
    serviceName: 'Service CRM',
  });
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
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatus | 'all'>('all');
  const deferredProductSearchQuery = useDeferredValue(productSearchQuery.trim());
  const deferredServiceSearchQuery = useDeferredValue(serviceSearchQuery.trim());
  const deferredClientSearchQuery = useDeferredValue(clientSearchQuery.trim());
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isSuppliersLoading, setIsSuppliersLoading] = useState(true);
  const [isServicesLoading, setIsServicesLoading] = useState(true);
  const [isClientsLoading, setIsClientsLoading] = useState(true);
  const [isSalesLoading, setIsSalesLoading] = useState(true);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true);
  const [isClientHistoryLoading, setIsClientHistoryLoading] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);
  const [isServiceSaving, setIsServiceSaving] = useState(false);
  const [isClientSaving, setIsClientSaving] = useState(false);
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

  useDashboardEffects({
    enabled,
    selectedClientId,
    setAllProducts,
    setClientDevices,
    setSuppliers,
    setAllClients,
    setSales,
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
    allProducts,
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
    mutateCreateProduct: async (payload) => createProductMutation.mutateAsync(payload),
    mutateUpdateProduct: async (productId, payload) =>
      updateProductMutation.mutateAsync({ productId, payload }),
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
      suppliers: enabled ? suppliers : [],
      allClients: enabled ? allClients : [],
      sales: enabled ? sales : [],
      services: enabled ? filteredServices : [],
      allEmployees: enabled ? allEmployees : [],
      settings: enabled ? settings : null,
      settingsForm: enabled ? settingsForm : { serviceName: 'Service CRM' },
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
      isClientHistoryLoading: enabled ? isClientHistoryLoading : false,
      isProductSaving,
      isServiceSaving,
      isClientSaving,
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
      setStatsPeriod,
      showError: setError,
      showSuccessMessage: setSuccessMessage,
    },
  };
};
