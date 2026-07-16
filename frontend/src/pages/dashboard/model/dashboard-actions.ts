import {
  exportClients,
  getClientHistory,
  importClients,
  mergeClients as mergeClientsApi,
} from '../../../entities/client/api/clientApi';
import { parseDecimal } from '../../../shared/lib/decimal';
import i18n from '../../../shared/i18n/config';
import { initialClientForm, toClientForm } from '../../../entities/client/model/forms';
import type {
  Client,
  ClientFormValues,
  ClientHistory,
  ClientStatus,
} from '../../../entities/client/model/types';
import {
  createEmployee,
  deleteEmployee,
  updateEmployee,
} from '../../../entities/employee/api/employeeApi';
import { initialEmployeeForm, toEmployeeForm } from '../../../entities/employee/model/forms';
import type {
  Employee,
  EmployeeFormValues,
} from '../../../entities/employee/model/types';

import { initialProductForm, toProductForm } from '../../../entities/product/model/forms';
import type {
  Product,
  ProductFormValues,
  ProductModelUpdatePayload,
} from '../../../entities/product/model/types';
import { initialSaleForm, toSaleForm } from '../../../entities/sale/model/forms';
import type { Sale, SaleFormValues } from '../../../entities/sale/model/types';
import { getSaleProductName } from '../../../entities/sale/lib/sale-product';
import {
  getCreateOrderSaleTitle,
  validateCreateOrderSaleLineItems,
} from '../../../widgets/dashboard/model/create-order-sale-validation';
import {
  initialServiceCatalogForm,
  toServiceCatalogForm,
} from '../../../entities/service-catalog/model/forms';
import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from '../../../entities/service-catalog/model/types';
import {
  updatePrintForms,
  updateSettings,
} from '../../../entities/settings/api/settingsApi';
import { hasEmployeePermission } from '../../../entities/employee/model/permissions';
import {
  applyPrintFormLocalOverrides,
  persistPrintFormLayoutOverrides,
} from '../../../widgets/dashboard/model/print-form-local-overrides';
import { normalizeDashboardPreferences } from '../../../entities/settings/model/dashboardPreferences';
import {
  createSupplier,
  mergeSuppliers as mergeSuppliersApi,
  updateSupplier,
} from '../../../entities/supplier/api/supplierApi';
import type { SupplierFormValues } from '../../../entities/supplier/model/types';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { ClientDeviceFormValues } from '../../../entities/client-device/model/types';
import type {
  AppSettings,
  AppSettingsFormValues,
} from '../../../entities/settings/model/types';
import {
  eraseAllData,
  seedDemoData,
  type DemoSeedKind,
} from '../../../features/demo-data/api/demoApi';
import { queryClient, queryKeys } from '../../../shared/api/queryClient';
import { getRequestErrorMessage, isConflictRequestError } from '../../../shared/lib/request';
import { createRuntimeId } from '../../../shared/lib/runtime-id';
import type { CreateOrderRequestPayload } from '../../../widgets/dashboard/model/order-request';
import { buildCreateOrderSaleLineItems } from '../../../widgets/dashboard/model/create-order-products';
import {
  buildRapidSaleLineItems,
  getRapidSaleDraftTotal,
  type RapidSaleDraftItem,
} from '../../../widgets/dashboard/model/rapid-sale-line-items';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

const isSaleResponse = (value: unknown): value is Sale => {
  if (typeof value !== 'object' || value === null) return false;

  const sale = value as Partial<Sale>;
  return (
    typeof sale.id === 'string' &&
    typeof sale.saleDate === 'string' &&
    typeof sale.kind === 'string' &&
    typeof sale.status === 'string' &&
    typeof sale.client === 'object' &&
    sale.client !== null &&
    Array.isArray(sale.timeline) &&
    Array.isArray(sale.paymentHistory)
  );
};

type DashboardActionParams = {
  allServices: ServiceCatalogItem[];
  allClients: Client[];
  clientDevices: ClientDevice[];
  sales: Sale[];
  allEmployees: Employee[];
  productForm: ProductFormValues;
  serviceForm: ServiceCatalogFormValues;
  clientForm: ClientFormValues;
  saleForm: SaleFormValues;
  employeeForm: EmployeeFormValues;
  settingsForm: AppSettingsFormValues;
  editingProductId: string | null;
  editingServiceId: string | null;
  editingClientId: string | null;
  editingSaleId: string | null;
  editingEmployeeId: string | null;
  selectedClientId: string | null;
  setSettings: Setter<AppSettings | null>;
  setSelectedClientId: Setter<string | null>;
  setClientHistory: Setter<ClientHistory | null>;
  setProductForm: Setter<ProductFormValues>;
  setServiceForm: Setter<ServiceCatalogFormValues>;
  setClientForm: Setter<ClientFormValues>;
  setSaleForm: Setter<SaleFormValues>;
  setEmployeeForm: Setter<EmployeeFormValues>;
  setSettingsForm: Setter<AppSettingsFormValues>;
  setEditingProductId: Setter<string | null>;
  setEditingServiceId: Setter<string | null>;
  setEditingClientId: Setter<string | null>;
  setEditingSaleId: Setter<string | null>;
  setEditingEmployeeId: Setter<string | null>;
  setProductSearchQuery: Setter<string>;
  setServiceSearchQuery: Setter<string>;
  setClientSearchQuery: Setter<string>;
  setClientStatusFilter: Setter<ClientStatus | 'all'>;
  setIsProductSaving: Setter<boolean>;
  setIsServiceSaving: Setter<boolean>;
  setIsClientSaving: Setter<boolean>;
  setIsClientImporting: Setter<boolean>;
  setIsClientExporting: Setter<boolean>;
  setIsSaleSaving: Setter<boolean>;
  setIsEmployeeSaving: Setter<boolean>;
  setIsSettingsSaving: Setter<boolean>;
  setIsSeeding: Setter<boolean>;
  setError: Setter<string>;
  setSuccessMessage: Setter<string>;
  currentEmployee: Employee | null;
  refreshSales: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshClientDevices: () => Promise<void>;
  refreshClients: () => Promise<void>;
  refreshServices: () => Promise<void>;
  refreshSuppliers: () => Promise<void>;
  refreshEmployees: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  mutateCreateProduct: (payload: ProductFormValues) => Promise<Product>;
  mutateUpdateProduct: (
    productId: string,
    payload: ProductFormValues,
  ) => Promise<Product>;
  mutateUpdateProductModel: (
    payload: ProductModelUpdatePayload,
  ) => Promise<{ matchedCount: number; products: Product[] }>;
  mutateCreateSale: (payload: SaleFormValues) => Promise<{
    sale: Sale;
    product: Product | null;
  }>;
  mutateUpdateSale: (saleId: string, payload: SaleFormValues) => Promise<{
    sale: Sale;
    product: Product | null;
  }>;
  mutateCreateClientDevice: (
    payload: ClientDeviceFormValues,
  ) => Promise<ClientDevice>;
  mutateUpdateClientDevice: (
    deviceId: string,
    payload: ClientDeviceFormValues,
  ) => Promise<ClientDevice>;
  mutateDeleteClientDevice: (deviceId: string) => Promise<{ id: string }>;
  mutateArchiveProduct: (
    productId: string,
  ) => Promise<
    { id: string; action: 'deleted' } | { action: 'deactivated'; product: Product }
  >;
  mutateDeleteProduct: (productId: string) => Promise<void>;
  mutateDeleteSale: (
    saleId: string,
  ) => Promise<{ id: string; restoredProductId: string }>;
  mutateCreateService: (
    payload: ServiceCatalogFormValues,
  ) => Promise<ServiceCatalogItem>;
  mutateUpdateService: (
    serviceId: string,
    payload: ServiceCatalogFormValues,
  ) => Promise<ServiceCatalogItem>;
  mutateDeleteService: (serviceId: string) => Promise<{ id: string }>;
  mutateArchiveService: (
    serviceId: string,
  ) => Promise<
    { id: string; action: 'deleted' } | { action: 'deactivated'; service: ServiceCatalogItem }
  >;
  mutateCreateClient: (payload: ClientFormValues) => Promise<Client>;
  mutateUpdateClient: (
    clientId: string,
    payload: ClientFormValues,
  ) => Promise<Client>;
  mutateDeleteClient: (clientId: string) => Promise<void>;
};

export const createDashboardActions = ({
  allServices,
  allClients,
  clientDevices,
  sales,
  allEmployees,
  productForm,
  serviceForm,
  clientForm,
  saleForm,
  employeeForm,
  settingsForm,
  editingProductId,
  editingServiceId,
  editingClientId,
  editingSaleId,
  editingEmployeeId,
  selectedClientId,
  setSettings,
  setSelectedClientId,
  setClientHistory,
  setProductForm,
  setServiceForm,
  setClientForm,
  setSaleForm,
  setEmployeeForm,
  setSettingsForm,
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
  refreshSales,
  refreshProducts,
  refreshClientDevices,
  refreshClients,
  refreshServices,
  refreshSuppliers,
  refreshEmployees,
  refreshSettings,
  mutateCreateProduct,
  mutateUpdateProduct,
  mutateUpdateProductModel,
  mutateCreateSale,
  mutateUpdateSale,
  mutateCreateClientDevice,
  mutateUpdateClientDevice,
  mutateDeleteClientDevice,
  mutateArchiveProduct,
  mutateDeleteProduct,
  mutateDeleteSale,
  mutateCreateService,
  mutateUpdateService,
  mutateDeleteService,
  mutateArchiveService,
  mutateCreateClient,
  mutateUpdateClient,
  mutateDeleteClient,
}: DashboardActionParams) => {
  const clearNotifications = () => {
    setError('');
    setSuccessMessage('');
  };

  const resetProductEditor = () => {
    setEditingProductId(null);
    setProductForm(initialProductForm);
  };
  const resetServiceEditor = () => {
    setEditingServiceId(null);
    setServiceForm(initialServiceCatalogForm);
  };
  const resetClientEditor = () => {
    setEditingClientId(null);
    setClientForm(initialClientForm);
  };
  const resetSaleEditor = () => {
    setEditingSaleId(null);
    setSaleForm(initialSaleForm);
  };
  const resetEmployeeEditor = () => {
    setEditingEmployeeId(null);
    setEmployeeForm(initialEmployeeForm);
  };

  const refreshClientHistory = async (clientId: string) => {
    setClientHistory(await getClientHistory(clientId));
  };

  const normalizePhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('380')) {
      return `+${digits}`;
    }
    return `+380${digits}`;
  };
  const normalizeServiceName = (value: string) =>
    value.trim().replace(/\s+/g, ' ').toLowerCase();
  const parseDecimalInput = (value: string) => {
    const numeric = parseDecimal(value || '0');
    return Number.isFinite(numeric) ? numeric : 0;
  };
  const safeRefresh = async (
    refreshAction: () => Promise<void>,
    fallbackMessage: string,
  ) => {
    try {
      await refreshAction();
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, fallbackMessage));
    }
  };
  const isOptimisticConflict = (error: unknown) =>
    isConflictRequestError(error) ||
    getRequestErrorMessage(error, '')
      .toLowerCase()
      .includes('modified by another user');
  const handleOptimisticConflict = async (
    error: unknown,
    refreshAction: () => Promise<void>,
    entityKey: string,
  ) => {
    if (!isOptimisticConflict(error)) return false;
    const entityLabel = i18n.t(entityKey);
    await safeRefresh(
      refreshAction,
      i18n.t('dashboard.actions.errors.failedRefresh', { entity: entityLabel }),
    );
    setError(
      i18n.t('dashboard.actions.errors.optimisticConflict', { entity: entityLabel }),
    );
    return true;
  };

  const formatOrderDateTime = (dateValue: string, timeValue: string) => {
    const now = new Date();
    const normalizedDate = dateValue || now.toISOString().slice(0, 10);
    const normalizedTime =
      timeValue ||
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (!normalizedTime) {
      return normalizedDate;
    }
    return `${normalizedDate}T${normalizedTime}`;
  };

  const buildProductIdentity = (payload: CreateOrderRequestPayload) => {
    const uniqueSuffix = `${Date.now().toString(36)}${Math.floor(
      Math.random() * 1000,
    )
      .toString(36)
      .padStart(2, '0')}`.toUpperCase();
    const serialFallback = `SRV-${uniqueSuffix}`;
    const articleFallback = `ORD-${uniqueSuffix}`;

    return {
      serialNumber: (payload.deviceSerialNumber || serialFallback).trim().toUpperCase(),
      article: articleFallback,
    };
  };

  return {
    replaceSaleInState: (sale: Sale) => {
      queryClient.setQueriesData<Sale[]>(
        { queryKey: queryKeys.sales },
        (current) => (current ?? []).map((item) => (item.id === sale.id ? sale : item)),
      );
    },
    setProductSearchQuery,
    setServiceSearchQuery,
    setClientSearchQuery,
    setClientStatusFilter,
    setSelectedClientId: (clientId: string | null) => {
      clearNotifications();
      setSelectedClientId(clientId);
      if (!clientId) {
        setClientHistory(null);
      }
    },
    onProductChange: <K extends keyof ProductFormValues>(
      field: K,
      value: ProductFormValues[K],
    ) => setProductForm((currentForm) => ({ ...currentForm, [field]: value })),
    onServiceChange: <K extends keyof ServiceCatalogFormValues>(
      field: K,
      value: ServiceCatalogFormValues[K],
    ) => setServiceForm((currentForm) => ({ ...currentForm, [field]: value })),
    onClientChange: <K extends keyof ClientFormValues>(
      field: K,
      value: ClientFormValues[K],
    ) => setClientForm((currentForm) => ({ ...currentForm, [field]: value })),
    onSaleChange: <K extends keyof SaleFormValues>(field: K, value: SaleFormValues[K]) =>
      setSaleForm((currentForm) => ({ ...currentForm, [field]: value })),
    onEmployeeChange: <K extends keyof EmployeeFormValues>(
      field: K,
      value: EmployeeFormValues[K],
    ) => setEmployeeForm((currentForm) => ({ ...currentForm, [field]: value })),
    onSettingsChange: <K extends keyof AppSettingsFormValues>(
      field: K,
      value: AppSettingsFormValues[K],
    ) => setSettingsForm((currentForm) => ({ ...currentForm, [field]: value })),
    editProduct: (product: Product) => {
      clearNotifications();
      setEditingProductId(product.id);
      setProductForm(toProductForm(product));
    },
    editService: (service: ServiceCatalogItem) => {
      clearNotifications();
      setEditingServiceId(service.id);
      setServiceForm(toServiceCatalogForm(service));
    },
    editClient: (client: Client) => {
      clearNotifications();
      setEditingClientId(client.id);
      setClientForm(toClientForm(client));
    },
    editSale: (sale: Sale) => {
      clearNotifications();
      setEditingSaleId(sale.id);
      setSaleForm(toSaleForm(sale));
    },
    editEmployee: (employee: Employee) => {
      clearNotifications();
      setEditingEmployeeId(employee.id);
      setEmployeeForm(toEmployeeForm(employee));
    },
    pickExistingClient: (client: Client) => {
      clearNotifications();
      setEditingClientId(client.id);
      setClientForm(toClientForm(client));
    },
    resetProductEditor,
    resetServiceEditor,
    resetClientEditor,
    resetSaleEditor,
    resetEmployeeEditor,
    saveProduct: async () => {
      setIsProductSaving(true);
      clearNotifications();

      try {
        if (editingProductId) {
          await mutateUpdateProduct(editingProductId, productForm);
          await safeRefresh(
            refreshProducts,
            i18n.t('dashboard.actions.errors.failedRefreshProducts'),
          );
          setSuccessMessage(i18n.t('success.productUpdated'));
        } else {
          await mutateCreateProduct(productForm);
          await safeRefresh(
            refreshProducts,
            i18n.t('dashboard.actions.errors.failedRefreshProducts'),
          );
          setSuccessMessage(i18n.t('dashboard.actions.success.productSavedToMongo'));
        }

        resetProductEditor();
      } catch (requestError) {
        if (
          await handleOptimisticConflict(
            requestError,
            refreshProducts,
            'dashboard.actions.entities.product',
          )
        ) {
          return;
        }
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedSaveProduct'),
          ),
        );
      } finally {
        setIsProductSaving(false);
      }
    },
    updateProductModelCard: async (payload: ProductModelUpdatePayload) => {
      setIsProductSaving(true);
      clearNotifications();

      try {
        const result = await mutateUpdateProductModel(payload);
        await safeRefresh(
          refreshProducts,
          i18n.t('dashboard.actions.errors.failedRefreshProducts'),
        );
        setSuccessMessage(
          result.matchedCount > 0
            ? i18n.t('dashboard.actions.success.productModelUpdated')
            : i18n.t('dashboard.actions.success.productModelNoStockRows'),
        );
        return result.matchedCount > 0;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedUpdateProductModel'),
          ),
        );
        return false;
      } finally {
        setIsProductSaving(false);
      }
    },
    saveService: async () => {
      clearNotifications();
      if (!editingServiceId) {
        const nextServiceName = normalizeServiceName(serviceForm.name);
        const hasDuplicateService = allServices.some(
          (service) =>
            normalizeServiceName(service.name) === nextServiceName,
        );

        if (hasDuplicateService) {
          setError(i18n.t('dashboard.actions.errors.duplicateService'));
          return;
        }
      }

      setIsServiceSaving(true);

      try {
        if (editingServiceId) {
          const editingService = allServices.find(
            (service) => service.id === editingServiceId,
          );
          await mutateUpdateService(editingServiceId, {
            ...serviceForm,
            isActive: editingService?.isActive,
          });
          await safeRefresh(
            refreshServices,
            i18n.t('errors.failedLoadServices'),
          );
          setSuccessMessage(i18n.t('success.serviceUpdated'));
        } else {
          await mutateCreateService(serviceForm);
          await safeRefresh(
            refreshServices,
            i18n.t('errors.failedLoadServices'),
          );
          setSuccessMessage(i18n.t('success.serviceSaved'));
        }

        resetServiceEditor();
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, i18n.t('errors.failedToSaveService')));
      } finally {
        setIsServiceSaving(false);
      }
    },
    saveClient: async () => {
      setIsClientSaving(true);
      clearNotifications();

      try {
        if (editingClientId) {
          const updatedClient = await mutateUpdateClient(editingClientId, clientForm);
          await safeRefresh(
            refreshClients,
            i18n.t('dashboard.actions.errors.failedRefreshClients'),
          );
          if (selectedClientId === updatedClient.id) {
            setSelectedClientId(updatedClient.id);
          }
          setSuccessMessage(i18n.t('success.clientUpdated'));
        } else {
          await mutateCreateClient(clientForm);
          await safeRefresh(
            refreshClients,
            i18n.t('dashboard.actions.errors.failedRefreshClients'),
          );
          setSuccessMessage(i18n.t('success.clientCreated'));
        }

        resetClientEditor();
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedSaveClient'),
          ),
        );
      } finally {
        setIsClientSaving(false);
      }
    },
    createClientCard: async (payload: ClientFormValues) => {
      setIsClientSaving(true);
      clearNotifications();

      try {
        await mutateCreateClient(payload);
        await safeRefresh(
          refreshClients,
          i18n.t('dashboard.actions.errors.failedRefreshClients'),
        );
        setSuccessMessage(i18n.t('success.clientCreated'));
        return true;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedCreateClientCard'),
          ),
        );
        return false;
      } finally {
        setIsClientSaving(false);
      }
    },
    createSupplierCard: async (payload: SupplierFormValues) => {
      setIsClientSaving(true);
      clearNotifications();
      try {
        await createSupplier(payload);
        await safeRefresh(
          refreshSuppliers,
          i18n.t('dashboard.actions.errors.failedRefreshSuppliers'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.supplierCreated'));
        return true;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedCreateSupplier'),
          ),
        );
        return false;
      } finally {
        setIsClientSaving(false);
      }
    },
    createClientDeviceCard: async (payload: ClientDeviceFormValues) => {
      setIsProductSaving(true);
      clearNotifications();
      try {
        await mutateCreateClientDevice(payload);
        await safeRefresh(
          refreshClientDevices,
          i18n.t('dashboard.actions.errors.failedRefreshClientDevices'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.clientDeviceCreated'));
        return true;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedCreateClientDevice'),
          ),
        );
        return false;
      } finally {
        setIsProductSaving(false);
      }
    },
    updateSupplierCard: async (supplierId: string, payload: SupplierFormValues) => {
      setIsClientSaving(true);
      clearNotifications();
      try {
        await updateSupplier(supplierId, payload);
        await safeRefresh(
          refreshSuppliers,
          i18n.t('dashboard.actions.errors.failedRefreshSuppliers'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.supplierUpdated'));
        return true;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedUpdateSupplier'),
          ),
        );
        return false;
      } finally {
        setIsClientSaving(false);
      }
    },
    mergeClients: async (targetClientId: string, sourceClientId: string) => {
      setIsClientSaving(true);
      clearNotifications();

      try {
        const result = await mergeClientsApi(targetClientId, sourceClientId);
        await safeRefresh(
          refreshClients,
          i18n.t('dashboard.actions.errors.failedRefreshClients'),
        );
        await safeRefresh(
          refreshSales,
          i18n.t('dashboard.actions.errors.failedRefreshSales'),
        );

        if (
          selectedClientId === sourceClientId ||
          selectedClientId === targetClientId
        ) {
          setSelectedClientId(result.client.id);
          await refreshClientHistory(result.client.id);
        }

        setSuccessMessage(
          i18n.t('dashboard.actions.success.clientsMerged', {
            count: result.movedSalesCount,
          }),
        );
        return true;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('clients.messages.errors.failedMerge'),
          ),
        );
        return false;
      } finally {
        setIsClientSaving(false);
      }
    },
    mergeSuppliers: async (
      targetSupplierId: string,
      sourceSupplierId: string,
    ) => {
      setIsClientSaving(true);
      clearNotifications();

      try {
        const result = await mergeSuppliersApi(
          targetSupplierId,
          sourceSupplierId,
        );
        await safeRefresh(
          refreshSuppliers,
          i18n.t('dashboard.actions.errors.failedRefreshSuppliers'),
        );
        setSuccessMessage(
          i18n.t('dashboard.actions.success.suppliersMerged', {
            count: result.movedSupplierOrdersCount,
          }),
        );
        return true;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedMergeSuppliers'),
          ),
        );
        return false;
      } finally {
        setIsClientSaving(false);
      }
    },
    updateClientCard: async (clientId: string, payload: ClientFormValues) => {
      setIsClientSaving(true);
      clearNotifications();

      try {
        const updatedClient = await mutateUpdateClient(clientId, payload);
        await safeRefresh(
          refreshClients,
          i18n.t('dashboard.actions.errors.failedRefreshClients'),
        );
        if (selectedClientId === updatedClient.id) {
          setSelectedClientId(updatedClient.id);
          await refreshClientHistory(updatedClient.id);
        }
        setSuccessMessage(i18n.t('success.clientUpdated'));
        return true;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedUpdateClient'),
          ),
        );
        return false;
      } finally {
        setIsClientSaving(false);
      }
    },
    saveSale: async () => {
      setIsSaleSaving(true);
      clearNotifications();

      try {
        if (editingSaleId) {
          await mutateUpdateSale(editingSaleId, saleForm);
          await safeRefresh(
            refreshProducts,
            i18n.t('dashboard.actions.errors.failedRefreshProducts'),
          );
          await safeRefresh(
            refreshSales,
            i18n.t('dashboard.actions.errors.failedRefreshSales'),
          );
          setSuccessMessage(i18n.t('dashboard.actions.success.saleUpdatedStockRecalculated'));
        } else {
          await mutateCreateSale(saleForm);
          await safeRefresh(
            refreshProducts,
            i18n.t('dashboard.actions.errors.failedRefreshProducts'),
          );
          await safeRefresh(
            refreshSales,
            i18n.t('dashboard.actions.errors.failedRefreshSales'),
          );
          setSuccessMessage(i18n.t('dashboard.actions.success.saleCreatedStockUpdated'));
        }

        resetSaleEditor();
        if (selectedClientId) {
          await refreshClientHistory(selectedClientId);
        }
      } catch (requestError) {
        if (
          await handleOptimisticConflict(
            requestError,
            refreshSales,
            'dashboard.actions.entities.sale',
          )
        ) {
          await safeRefresh(
            refreshProducts,
            i18n.t('dashboard.actions.errors.failedRefreshProducts'),
          );
          return;
        }
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedSaveSale'),
          ),
        );
      } finally {
        setIsSaleSaving(false);
      }
    },
    saveEmployee: async () => {
      setIsEmployeeSaving(true);
      clearNotifications();
      try {
        if (editingEmployeeId) {
          await updateEmployee(editingEmployeeId, employeeForm);
          setSuccessMessage(i18n.t('dashboard.actions.success.employeeUpdated'));
        } else {
          await createEmployee(employeeForm);
          setSuccessMessage(i18n.t('dashboard.actions.success.employeeCreated'));
        }
        await safeRefresh(
          refreshEmployees,
          i18n.t('dashboard.actions.errors.failedRefreshEmployees'),
        );
        resetEmployeeEditor();
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedSaveEmployee'),
          ),
        );
      } finally {
        setIsEmployeeSaving(false);
      }
    },
    saveSettings: async () => {
      setIsSettingsSaving(true);
      clearNotifications();
      try {
        persistPrintFormLayoutOverrides(
          currentEmployee?.id,
          settingsForm.printForms,
        );
        const canEditAllSettings = currentEmployee?.role === 'owner';
        const canEditPrintFormsOnly =
          !canEditAllSettings &&
          hasEmployeePermission(currentEmployee, 'printForms.manage');
        const updated = canEditPrintFormsOnly
          ? await updatePrintForms(settingsForm.printForms)
          : await updateSettings(settingsForm);
        const printFormsWithLocalOverrides = applyPrintFormLocalOverrides(
          updated.printForms,
          currentEmployee?.id,
        );
        setSettings(updated);
        setSettingsForm((current) => ({
          ...current,
          ...(canEditAllSettings
            ? {
                serviceName: updated.serviceName,
                company: updated.company,
                companyAddress: updated.companyAddress,
                companyId: updated.companyId,
                companyIban: updated.companyIban,
                companyEmail: updated.companyEmail,
                companySite: updated.companySite,
                printForms: printFormsWithLocalOverrides,
                orderDefaults: updated.orderDefaults,
                numbering: updated.numbering,
                financeDefaults: updated.financeDefaults,
                notificationSettings: updated.notificationSettings,
                dashboardPreferences: normalizeDashboardPreferences(
                  updated.dashboardPreferences,
                ),
              }
            : {
                printForms: printFormsWithLocalOverrides,
              }),
        }));
        await safeRefresh(
          refreshSettings,
          i18n.t('dashboard.actions.errors.failedRefreshSettings'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.settingsSaved'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedSaveSettings'),
          ),
        );
      } finally {
        setIsSettingsSaving(false);
      }
    },
    deleteProduct: async (product: Product) => {
      clearNotifications();
      if (
        !window.confirm(
          i18n.t('dashboard.actions.confirms.deleteProduct', { name: product.name }),
        )
      ) {
        return;
      }

      try {
        await mutateDeleteProduct(product.id);
        await safeRefresh(
          refreshProducts,
          i18n.t('dashboard.actions.errors.failedRefreshProducts'),
        );
        if (editingProductId === product.id) resetProductEditor();
        setSuccessMessage(i18n.t('dashboard.actions.success.productDeleted'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedDeleteProduct'),
          ),
        );
      }
    },
    archiveProduct: async (product: Product) => {
      clearNotifications();
      if (
        !window.confirm(
          i18n.t('dashboard.actions.confirms.archiveProduct', { name: product.name }),
        )
      ) {
        return;
      }

      try {
        const result = await mutateArchiveProduct(product.id);
        if (result.action === 'deleted') {
          await safeRefresh(
            refreshProducts,
            i18n.t('dashboard.actions.errors.failedRefreshProducts'),
          );
          if (editingProductId === product.id) resetProductEditor();
          setSuccessMessage(i18n.t('dashboard.actions.success.productDeleted'));
          return;
        }

        await safeRefresh(
          refreshProducts,
          i18n.t('dashboard.actions.errors.failedRefreshProducts'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.productDeactivated'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedArchiveProduct'),
          ),
        );
      }
    },
    activateProduct: async (product: Product) => {
      clearNotifications();
      if (product.isActive) return;
      setIsProductSaving(true);

      try {
        const updatedProductResponse = await mutateUpdateProduct(product.id, {
          ...toProductForm(product),
          isActive: true,
        });
        const updatedProduct = {
          ...updatedProductResponse,
          isActive: true,
        };
        await safeRefresh(
          refreshProducts,
          i18n.t('dashboard.actions.errors.failedRefreshProducts'),
        );
        if (editingProductId === updatedProduct.id) {
          setProductForm(toProductForm(updatedProduct));
        }
        setSuccessMessage(i18n.t('dashboard.actions.success.productActivated'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedActivateProduct'),
          ),
        );
      } finally {
        setIsProductSaving(false);
      }
    },
    deleteService: async (service: ServiceCatalogItem) => {
      clearNotifications();
      if (
        !window.confirm(
          i18n.t('dashboard.actions.confirms.deleteService', { name: service.name }),
        )
      ) {
        return;
      }

      try {
        await mutateDeleteService(service.id);
        await safeRefresh(
          refreshServices,
          i18n.t('errors.failedLoadServices'),
        );
        if (editingServiceId === service.id) resetServiceEditor();
        setSuccessMessage(i18n.t('dashboard.actions.success.serviceDeleted'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedDeleteService'),
          ),
        );
      }
    },
    archiveService: async (service: ServiceCatalogItem) => {
      clearNotifications();
      if (
        !window.confirm(
          i18n.t('dashboard.actions.confirms.archiveService', { name: service.name }),
        )
      ) {
        return;
      }

      try {
        const result = await mutateArchiveService(service.id);
        if (result.action === 'deleted') {
          await safeRefresh(
            refreshServices,
            i18n.t('errors.failedLoadServices'),
          );
          if (editingServiceId === service.id) resetServiceEditor();
          setSuccessMessage(i18n.t('dashboard.actions.success.serviceDeleted'));
          return;
        }

        await safeRefresh(
          refreshServices,
          i18n.t('errors.failedLoadServices'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.serviceDeactivated'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedArchiveService'),
          ),
        );
      }
    },
    activateService: async (service: ServiceCatalogItem) => {
      clearNotifications();
      if (service.isActive) return;
      setIsServiceSaving(true);

      try {
        const updatedServiceResponse = await mutateUpdateService(service.id, {
          ...toServiceCatalogForm(service),
          isActive: true,
        });
        const updatedService = {
          ...updatedServiceResponse,
          isActive: true,
        };
        await safeRefresh(
          refreshServices,
          i18n.t('errors.failedLoadServices'),
        );
        if (editingServiceId === updatedService.id) {
          setServiceForm(toServiceCatalogForm(updatedService));
        }
        setSuccessMessage(i18n.t('dashboard.actions.success.serviceActivated'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedActivateService'),
          ),
        );
      } finally {
        setIsServiceSaving(false);
      }
    },
    deleteClient: async (client: Client) => {
      clearNotifications();
      const hasSalesHistory = sales.some((sale) => sale.client.id === client.id);
      if (hasSalesHistory) {
        setError(i18n.t('clients.messages.errors.clientHasOrders'));
        return;
      }
      if (
        !window.confirm(
          i18n.t('dashboard.actions.confirms.deleteClient', { name: client.name }),
        )
      ) {
        return;
      }

      try {
        await mutateDeleteClient(client.id);
        await safeRefresh(
          refreshClients,
          i18n.t('dashboard.actions.errors.failedRefreshClients'),
        );
        if (selectedClientId === client.id) {
          setSelectedClientId(null);
          setClientHistory(null);
        }
        if (editingClientId === client.id) resetClientEditor();
        setSuccessMessage(i18n.t('clients.messages.success.clientDeleted'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedDeleteClient'),
          ),
        );
      }
    },
    deleteSale: async (sale: Sale) => {
      clearNotifications();
      if (
        !window.confirm(
          i18n.t('dashboard.actions.confirms.deleteSale', {
            name: getSaleProductName(
              sale,
              i18n.t('dashboard.actions.entities.product'),
            ),
          }),
        )
      ) {
        return;
      }

      try {
        await mutateDeleteSale(sale.id);
        await safeRefresh(
          refreshProducts,
          i18n.t('dashboard.actions.errors.failedRefreshProducts'),
        );
        await safeRefresh(
          refreshSales,
          i18n.t('dashboard.actions.errors.failedRefreshSales'),
        );
        if (editingSaleId === sale.id) resetSaleEditor();
        if (selectedClientId === sale.client.id) await refreshClientHistory(sale.client.id);
        setSuccessMessage(i18n.t('dashboard.actions.success.saleDeletedStockRestored'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedDeleteSale'),
          ),
        );
      }
    },
    deleteEmployee: async (employee: Employee) => {
      clearNotifications();

      if (currentEmployee?.id === employee.id) {
        setError(i18n.t('dashboard.actions.errors.cannotDeleteOwnAccount'));
        return;
      }

      try {
        await deleteEmployee(employee.id);
        if (editingEmployeeId === employee.id) resetEmployeeEditor();
        await safeRefresh(
          refreshEmployees,
          i18n.t('dashboard.actions.errors.failedRefreshEmployees'),
        );
        await safeRefresh(
          refreshSales,
          i18n.t('dashboard.actions.errors.failedRefreshSales'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.employeeDeleted'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedDeleteEmployee'),
          ),
        );
      }
    },

    importClientsFromFile: async (file: File) => {
      setIsClientImporting(true);
      clearNotifications();
      try {
        const report = await importClients(file);
        await safeRefresh(
          refreshClients,
          i18n.t('dashboard.actions.errors.failedRefreshClients'),
        );
        setSuccessMessage(
          i18n.t('dashboard.actions.success.clientImportCompleted', {
            created: report.created,
            skippedExisting: report.skippedExisting,
            skippedInvalid: report.skippedMissingRequired + report.validationFailed,
          }),
        );
        return true;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedImportClients'),
          ),
        );
        return false;
      } finally {
        setIsClientImporting(false);
      }
    },
    exportClients: async () => {
      setIsClientExporting(true);
      clearNotifications();
      try {
        await exportClients();
        setSuccessMessage(i18n.t('dashboard.actions.success.clientExportPrepared'));
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedExportClients'),
          ),
        );
      } finally {
        setIsClientExporting(false);
      }
    },
    seedDemoData: async (kind: DemoSeedKind = 'all') => {
      setIsSeeding(true);
      clearNotifications();
      try {
        const result = await seedDemoData(kind);
        queryClient.setQueryData(queryKeys.products, result.products);
        queryClient.setQueryData(queryKeys.catalogProducts, []);
        queryClient.setQueryData(queryKeys.clients, result.clients);
        queryClient.setQueriesData({ queryKey: queryKeys.sales }, result.sales);
        setSelectedClientId(null);
        setClientHistory(null);
        resetProductEditor();
        resetClientEditor();
        resetSaleEditor();
        setProductSearchQuery('');
        setClientSearchQuery('');
        setClientStatusFilter('all');
        setSuccessMessage(
          result.safetyBackupId
            ? i18n.t('dashboard.actions.success.demoSeedWithBackup', {
                message: result.message,
                safetyBackupId: result.safetyBackupId,
              })
            : result.message,
        );
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedSeedDemoData'),
          ),
        );
      } finally {
        setIsSeeding(false);
      }
    },
    updateClientDeviceCard: async (deviceId: string, payload: ClientDeviceFormValues) => {
      setIsProductSaving(true);
      clearNotifications();
      try {
        await mutateUpdateClientDevice(deviceId, payload);
        await safeRefresh(
          refreshClientDevices,
          i18n.t('dashboard.actions.errors.failedRefreshClientDevices'),
        );
        await safeRefresh(
          refreshSales,
          i18n.t('dashboard.actions.errors.failedRefreshSales'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.clientDeviceUpdated'));
        return true;
      } catch (requestError) {
        if (
          await handleOptimisticConflict(
            requestError,
            refreshClientDevices,
            'dashboard.actions.entities.clientDevice',
          )
        ) {
          return false;
        }
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedUpdateClientDevice'),
          ),
        );
        return false;
      } finally {
        setIsProductSaving(false);
      }
    },
    deleteClientDeviceCard: async (deviceId: string) => {
      setIsProductSaving(true);
      clearNotifications();
      try {
        await mutateDeleteClientDevice(deviceId);
        await safeRefresh(
          refreshClientDevices,
          i18n.t('dashboard.actions.errors.failedRefreshClientDevices'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.clientDeviceRemoved'));
        return true;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedRemoveClientDevice'),
          ),
        );
        return false;
      } finally {
        setIsProductSaving(false);
      }
    },
    eraseAllData: async () => {
      setIsSeeding(true);
      clearNotifications();
      try {
        const result = await eraseAllData();
        queryClient.setQueryData(queryKeys.products, result.products);
        queryClient.setQueryData(queryKeys.catalogProducts, []);
        queryClient.setQueryData(queryKeys.clients, result.clients);
        queryClient.setQueriesData({ queryKey: queryKeys.sales }, result.sales);
        setSelectedClientId(null);
        setClientHistory(null);
        resetProductEditor();
        resetClientEditor();
        resetSaleEditor();
        setProductSearchQuery('');
        setClientSearchQuery('');
        setClientStatusFilter('all');
        setSuccessMessage(result.message);
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedEraseData'),
          ),
        );
      } finally {
        setIsSeeding(false);
      }
    },
    saveOrderRequest: async (payload: CreateOrderRequestPayload) => {
      setIsSaleSaving(true);
      clearNotifications();

      try {
        const normalizedPhone = normalizePhone(payload.clientPhone);
        const clientName = payload.clientName.trim();
        const saleItems = (payload.saleItems ?? [])
          .map((item) => {
            const quantity = Number.parseInt(item.quantity || '1', 10);
            const price = parseDecimalInput(item.price);
            const warrantyPeriod = Number.parseInt(item.warrantyPeriod || '0', 10);

            return {
              ...item,
              name: item.name.trim(),
              serialNumbers: Array.isArray(item.serialNumbers)
                ? item.serialNumbers
                    .map((serial) => String(serial ?? '').trim().toUpperCase())
                    .filter(Boolean)
                : [],
              quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
              price: Number.isFinite(price) && price >= 0 ? price : 0,
              warrantyPeriod:
                Number.isFinite(warrantyPeriod) && warrantyPeriod >= 0
                  ? warrantyPeriod
                  : 0,
            };
          })
          .filter((item) => item.name.length >= 2);
        const saleServiceItems = (payload.saleServiceItems ?? [])
          .map((item) => {
            const quantity = Number.parseInt(item.quantity || '1', 10);
            const price = parseDecimalInput(item.price);
            const warrantyPeriod = Number.parseInt(item.warrantyPeriod || '1', 10);

            return {
              ...item,
              name: item.name.trim(),
              quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
              price: Number.isFinite(price) && price >= 0 ? price : 0,
              warrantyPeriod:
                Number.isFinite(warrantyPeriod) && warrantyPeriod >= 0
                  ? warrantyPeriod
                  : 1,
            };
          })
          .filter((item) => item.name.length >= 2);
        const primarySaleItem = payload.sourceTab === 'sale' ? saleItems[0] : null;
        const saleTitle =
          payload.sourceTab === 'sale'
            ? getCreateOrderSaleTitle(saleItems, saleServiceItems)
            : '';
        const deviceName =
          payload.sourceTab === 'sale'
            ? saleTitle
            : payload.deviceName.trim();
        const saleProductsTotal = saleItems.reduce(
          (total, item) => total + item.price * item.quantity,
          0,
        );
        const saleServicesTotal = saleServiceItems.reduce(
          (total, item) => total + item.price * item.quantity,
          0,
        );
        const estimatedCost =
          payload.sourceTab === 'sale' &&
          (saleItems.length > 0 || saleServiceItems.length > 0)
            ? saleProductsTotal + saleServicesTotal
            : parseDecimal(payload.estimatedCost || '0');

        if (normalizedPhone.replace(/\D/g, '').length < 12) {
          throw new Error(i18n.t('dashboard.actions.errors.clientPhoneRequired'));
        }
        if (clientName.length < 2) {
          throw new Error(i18n.t('dashboard.actions.errors.clientNameMinLength'));
        }
        if (payload.sourceTab === 'sale') {
          const saleLineItemsErrorKey = validateCreateOrderSaleLineItems(
            saleItems,
            saleServiceItems,
          );
          if (saleLineItemsErrorKey) {
            throw new Error(i18n.t(saleLineItemsErrorKey));
          }
        } else if (deviceName.length < 2) {
          throw new Error(i18n.t('dashboard.actions.errors.deviceNameMinLength'));
        }
        if (!payload.managerId.trim()) {
          throw new Error(i18n.t('dashboard.actions.errors.managerRequired'));
        }
        if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
          throw new Error(i18n.t('dashboard.actions.errors.estimatedCostInvalid'));
        }
        if (
          payload.sourceTab === 'sale' &&
          saleItems.some((item) => item.productId && item.quantity < 1)
        ) {
          throw new Error(i18n.t('dashboard.actions.errors.saleItemQuantityMin'));
        }
        const normalizedPhoneDigits = normalizedPhone.replace(/\D/g, '');
        const existingClient = allClients.find((client) =>
          (client.phones?.length ? client.phones : [client.phone]).some(
            (phone) => phone.replace(/\D/g, '') === normalizedPhoneDigits,
          ),
        );
        const client =
          existingClient ??
          (await mutateCreateClient({
            phone: normalizedPhone,
            phones: [normalizedPhone],
            name: clientName,
            email: '',
            address: '',
            registrationId: '',
            iban: '',
            note: payload.discountCode ? `Discount code: ${payload.discountCode.trim()}` : '',
            status: '',
          }));

        if (!existingClient) {
          await safeRefresh(
            refreshClients,
            i18n.t('dashboard.actions.errors.failedRefreshClients'),
          );
        }

        const { serialNumber: fallbackSerialNumber } = buildProductIdentity(payload);
        const repairDeviceSerialNumber = payload.deviceSerialNumber.trim().toUpperCase();
        const serialNumber =
          payload.sourceTab === 'repair'
            ? repairDeviceSerialNumber
            : fallbackSerialNumber;
        const managerName = allEmployees.find((employee) => employee.id === payload.managerId)?.name ?? '';
        const masterName = allEmployees.find((employee) => employee.id === payload.masterId)?.name ?? '';
        const createdAt = new Date().toISOString();
        const author = currentEmployee?.name ?? managerName ?? i18n.t('common.system');

        const kitsNote = payload.deviceKit.trim();
        const noteParts = [
          kitsNote ? `(kits: ${kitsNote})` : '',
          payload.issueFromClient.trim(),
          payload.sourceTab === 'repair' ? payload.externalView.trim() : '',
          payload.serviceName.trim()
            ? `Service: ${payload.serviceName.trim()}`
            : '',
          payload.extraFlags.length > 0 ? `Flags: ${payload.extraFlags.join(', ')}` : '',
          managerName ? `Manager: ${managerName}` : '',
          payload.sourceTab === 'repair' && masterName ? `Master: ${masterName}` : '',
          payload.sourceTab ? `Type: ${payload.sourceTab}` : '',
        ].filter(Boolean);
        const productLineItems =
          payload.sourceTab === 'sale' && saleItems.length > 0
            ? buildCreateOrderSaleLineItems(
                saleItems.map((item) => ({
                  id: item.id || createRuntimeId(),
                  productId: item.productId,
                  catalogProductId: item.catalogProductId,
                  name: item.name,
                  article: item.article,
                  serialNumber: item.serialNumber,
                  serialNumbers: item.serialNumbers,
                  price: String(item.price),
                  quantity: String(item.quantity),
                  warrantyPeriod: String(item.warrantyPeriod),
                  warehouse: item.warehouse,
                })),
              )
            : [];
        const serviceLineItems =
          payload.sourceTab === 'sale' && saleServiceItems.length > 0
            ? saleServiceItems.map((item) => ({
                id: item.id || createRuntimeId(),
                kind: 'service' as const,
                serviceId: item.serviceId || undefined,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                warrantyPeriod: item.warrantyPeriod,
              }))
            : [];
        const lineItems = [...productLineItems, ...serviceLineItems];

        const createdSaleResult = await mutateCreateSale({
          saleDate: formatOrderDateTime(payload.readyDate, payload.readyTime),
          clientId: client.id,
          productId: '',
          quantity: String(payload.sourceTab === 'sale' && primarySaleItem ? primarySaleItem.quantity : 1),
          salePrice: String(estimatedCost),
          kind: payload.sourceTab,
          status: 'new',
          paidAmount: 0,
          note: payload.sourceTab === 'repair' ? noteParts.join('\n') : '',
          userNote: '',
          managerId: payload.managerId,
          masterId: payload.sourceTab === 'repair' ? payload.masterId : '',
          deviceName: payload.sourceTab === 'repair' ? deviceName : saleTitle,
          serialNumber: payload.sourceTab === 'repair' ? serialNumber : '',
          timeline: [
            ...(payload.issueFromClient.trim()
              ? [
                  {
                    id: createRuntimeId(),
                    author,
                    message: payload.issueFromClient.trim(),
                    createdAt,
                  },
                ]
              : []),
          ],
          paymentHistory: [],
          lineItems: lineItems.length > 0 ? lineItems : undefined,
        });
        if (!isSaleResponse(createdSaleResult.sale)) {
          throw new Error(i18n.t('dashboard.actions.errors.unexpectedCreateSaleResponse'));
        }

        const deviceAlreadyExists = clientDevices.some(
          (device) =>
            device.clientId === client.id &&
            device.name.trim().toLowerCase() === deviceName.trim().toLowerCase(),
        );
        if (payload.sourceTab === 'repair' && !deviceAlreadyExists) {
          await mutateCreateClientDevice({
            clientId: client.id,
            clientName: client.name,
            clientPhone: client.phone,
            name: deviceName,
            serialNumber: '',
            note: '',
            source: 'repairOrder',
            isActive: true,
          });
        }
        await safeRefresh(
          refreshProducts,
          i18n.t('dashboard.actions.errors.failedRefreshProducts'),
        );
        await safeRefresh(
          refreshSales,
          i18n.t('dashboard.actions.errors.failedRefreshSales'),
        );
        await safeRefresh(
          refreshClientDevices,
          i18n.t('dashboard.actions.errors.failedRefreshClientDevices'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.orderSaved'));
        return createdSaleResult.sale;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedSaveOrder'),
          ),
        );
        return null;
      } finally {
        setIsSaleSaving(false);
      }
    },
    saveRapidSale: async (items: RapidSaleDraftItem[]) => {
      setIsSaleSaving(true);
      clearNotifications();

      try {
        if (!currentEmployee?.id) {
          throw new Error(i18n.t('dashboard.actions.errors.managerRequired'));
        }

        const lineItems = buildRapidSaleLineItems(items);
        const salePrice = getRapidSaleDraftTotal(items);
        const primaryProduct = lineItems.find((item) => item.kind === 'product');
        const createdAt = new Date().toISOString();
        const author = currentEmployee.name ?? i18n.t('common.system');

        const createdSaleResult = await mutateCreateSale({
          saleDate: new Date().toISOString(),
          clientId: '',
          productId: '',
          quantity: String(primaryProduct?.quantity ?? 1),
          salePrice: String(Math.round(salePrice * 100) / 100),
          kind: 'sale',
          status: 'new',
          paidAmount: 0,
          note: '',
          userNote: '',
          managerId: currentEmployee.id,
          masterId: '',
          isRapidSale: true,
          timeline: [
            {
              id: createRuntimeId(),
              kind: 'system',
              author,
              message: 'Rapid sale created',
              createdAt,
            },
          ],
          paymentHistory: [],
          lineItems,
        });

        if (!isSaleResponse(createdSaleResult.sale)) {
          throw new Error(i18n.t('dashboard.actions.errors.unexpectedCreateSaleResponse'));
        }

        await safeRefresh(
          refreshProducts,
          i18n.t('dashboard.actions.errors.failedRefreshProducts'),
        );
        await safeRefresh(
          refreshSales,
          i18n.t('dashboard.actions.errors.failedRefreshSales'),
        );
        setSuccessMessage(i18n.t('dashboard.actions.success.orderSaved'));
        return createdSaleResult.sale;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            i18n.t('dashboard.actions.errors.failedSaveOrder'),
          ),
        );
        return null;
      } finally {
        setIsSaleSaving(false);
      }
    },
  };
};

