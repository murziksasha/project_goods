import {
  getClientHistory,
  mergeClients as mergeClientsApi,
} from '../../../entities/client/api/clientApi';
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
import {
  exportProducts,
} from '../../../entities/product/api/productApi';
import { initialProductForm, toProductForm } from '../../../entities/product/model/forms';
import type {
  Product,
  ProductFormValues,
  ProductModelUpdatePayload,
} from '../../../entities/product/model/types';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import { initialSaleForm, toSaleForm } from '../../../entities/sale/model/forms';
import type { Sale, SaleFormValues } from '../../../entities/sale/model/types';
import {
} from '../../../entities/service-catalog/api/serviceCatalogApi';
import {
  initialServiceCatalogForm,
  toServiceCatalogForm,
} from '../../../entities/service-catalog/model/forms';
import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from '../../../entities/service-catalog/model/types';
import { updateSettings } from '../../../entities/settings/api/settingsApi';
import {
  createSupplier,
  mergeSuppliers as mergeSuppliersApi,
  updateSupplier,
} from '../../../entities/supplier/api/supplierApi';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
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
import { getRequestErrorMessage, isConflictRequestError } from '../../../shared/lib/request';
import type { CreateOrderRequestPayload } from '../../../widgets/dashboard/model/order-request';
import { buildCreateOrderSaleLineItems } from '../../../widgets/dashboard/model/create-order-products';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

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
  setAllProducts: Setter<Product[]>;
  setCatalogProducts: Setter<CatalogProduct[]>;
  setAllClients: Setter<Client[]>;
  setAllEmployees: Setter<Employee[]>;
  setSuppliers: Setter<Supplier[]>;
  setSales: Setter<Sale[]>;
  setServices: Setter<ServiceCatalogItem[]>;
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
  setIsSaleSaving: Setter<boolean>;
  setIsEmployeeSaving: Setter<boolean>;
  setIsSettingsSaving: Setter<boolean>;
  setIsExporting: Setter<boolean>;
  setIsSeeding: Setter<boolean>;
  setError: Setter<string>;
  setSuccessMessage: Setter<string>;
  currentEmployee: Employee | null;
  refreshSales: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshClientDevices: () => Promise<void>;
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
  setAllProducts,
  setCatalogProducts,
  setAllClients,
  setAllEmployees,
  setSuppliers,
  setSales,
  setServices,
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
  setIsSaleSaving,
  setIsEmployeeSaving,
  setIsSettingsSaving,
  setIsExporting,
  setIsSeeding,
  setError,
  setSuccessMessage,
  currentEmployee,
  refreshSales,
  refreshProducts,
  refreshClientDevices,
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
    const normalized = value.replace(/\s+/g, '').replace(',', '.').trim();
    const numeric = Number.parseFloat(normalized || '0');
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
    entityLabel: string,
  ) => {
    if (!isOptimisticConflict(error)) return false;
    await safeRefresh(refreshAction, `Failed to refresh ${entityLabel}.`);
    setError(
      `${entityLabel} was updated by another user. Latest data loaded, please retry.`,
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
      setSales((current) =>
        current.map((item) => (item.id === sale.id ? sale : item)),
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
          await safeRefresh(refreshProducts, 'Failed to refresh products.');
          setSuccessMessage('Product updated.');
        } else {
          await mutateCreateProduct(productForm);
          await safeRefresh(refreshProducts, 'Failed to refresh products.');
          setSuccessMessage('Product saved to MongoDB.');
        }

        resetProductEditor();
      } catch (requestError) {
        if (
          await handleOptimisticConflict(
            requestError,
            refreshProducts,
            'Product',
          )
        ) {
          return;
        }
        setError(getRequestErrorMessage(requestError, 'Failed to save product.'));
      } finally {
        setIsProductSaving(false);
      }
    },
    updateProductModelCard: async (payload: ProductModelUpdatePayload) => {
      setIsProductSaving(true);
      clearNotifications();

      try {
        const result = await mutateUpdateProductModel(payload);
        await safeRefresh(refreshProducts, 'Failed to refresh products.');
        setSuccessMessage(
          result.matchedCount > 0
            ? 'Product model updated.'
            : 'No stock rows found for this product model.',
        );
        return result.matchedCount > 0;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(
            requestError,
            'Failed to update product model.',
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
          setError('Такая услуга уже есть в каталоге.');
          return;
        }
      }

      setIsServiceSaving(true);

      try {
        if (editingServiceId) {
          const editingService = allServices.find(
            (service) => service.id === editingServiceId,
          );
          const updatedService = await mutateUpdateService(
            editingServiceId,
            {
              ...serviceForm,
              isActive: editingService?.isActive,
            },
          );
          setServices((current) =>
            current.map((item) =>
              item.id === updatedService.id ? updatedService : item,
            ),
          );
          setSuccessMessage('Service updated.');
        } else {
          const createdService = await mutateCreateService(serviceForm);
          setServices((current) => [createdService, ...current]);
          setSuccessMessage('Service saved to catalog.');
        }

        resetServiceEditor();
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to save service.'));
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
          setAllClients((current) =>
            current.map((item) => (item.id === updatedClient.id ? updatedClient : item)),
          );
          if (selectedClientId === updatedClient.id) {
            setSelectedClientId(updatedClient.id);
          }
          setSuccessMessage('Клієнта оновлено.');
        } else {
          const createdClient = await mutateCreateClient(clientForm);
          setAllClients((current) => [createdClient, ...current]);
          setSuccessMessage('Картку клієнта створено.');
        }

        resetClientEditor();
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Не вдалося зберегти клієнта.'));
      } finally {
        setIsClientSaving(false);
      }
    },
    createClientCard: async (payload: ClientFormValues) => {
      setIsClientSaving(true);
      clearNotifications();

      try {
        const createdClient = await mutateCreateClient(payload);
        setAllClients((current) => [createdClient, ...current]);
        setSuccessMessage('Картку клієнта створено.');
        return true;
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Не вдалося створити картку клієнта.'));
        return false;
      } finally {
        setIsClientSaving(false);
      }
    },
    createSupplierCard: async (payload: SupplierFormValues) => {
      setIsClientSaving(true);
      clearNotifications();
      try {
        const createdSupplier = await createSupplier(payload);
        setSuppliers((current) => [createdSupplier, ...current]);
        setSuccessMessage('Supplier created.');
        return true;
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to create supplier.'));
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
        await safeRefresh(refreshClientDevices, 'Failed to refresh client devices.');
        setSuccessMessage('Client device created.');
        return true;
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to create client device.'));
        return false;
      } finally {
        setIsProductSaving(false);
      }
    },
    updateSupplierCard: async (supplierId: string, payload: SupplierFormValues) => {
      setIsClientSaving(true);
      clearNotifications();
      try {
        const updatedSupplier = await updateSupplier(supplierId, payload);
        setSuppliers((current) =>
          current.map((item) => (item.id === updatedSupplier.id ? updatedSupplier : item)),
        );
        setSuccessMessage('Supplier updated.');
        return true;
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to update supplier.'));
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
        setAllClients((current) =>
          current
            .filter((client) => client.id !== result.removedClientId)
            .map((client) =>
              client.id === result.client.id ? result.client : client,
            ),
        );
        setSales((current) =>
          current.map((sale) =>
            sale.client.id === result.removedClientId
              ? {
                  ...sale,
                  client: {
                    ...sale.client,
                    id: result.client.id,
                    name: result.client.name,
                    phone: result.client.phone,
                    status: result.client.status,
                  },
                }
              : sale,
          ),
        );

        if (
          selectedClientId === sourceClientId ||
          selectedClientId === targetClientId
        ) {
          setSelectedClientId(result.client.id);
          await refreshClientHistory(result.client.id);
        }

        setSuccessMessage(
          `Клієнтів обʼєднано. Перенесено звернень: ${result.movedSalesCount}.`,
        );
        return true;
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Не вдалося обʼєднати клієнтів.'));
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
        setSuppliers((current) =>
          current
            .filter((supplier) => supplier.id !== result.removedSupplierId)
            .map((supplier) =>
              supplier.id === result.supplier.id
                ? result.supplier
                : supplier,
            ),
        );
        setSuccessMessage(
          `Suppliers merged. Moved supplier orders: ${result.movedSupplierOrdersCount}.`,
        );
        return true;
      } catch (requestError) {
        setError(
          getRequestErrorMessage(requestError, 'Failed to merge suppliers.'),
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
        setAllClients((current) =>
          current.map((item) =>
            item.id === updatedClient.id ? updatedClient : item,
          ),
        );
        if (selectedClientId === updatedClient.id) {
          setSelectedClientId(updatedClient.id);
          await refreshClientHistory(updatedClient.id);
        }
        setSuccessMessage('Клієнта оновлено.');
        return true;
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Не вдалося оновити клієнта.'));
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
          await safeRefresh(refreshProducts, 'Failed to refresh products.');
          await safeRefresh(refreshSales, 'Failed to refresh sales.');
          setSuccessMessage('Sale updated and stock recalculated.');
        } else {
          await mutateCreateSale(saleForm);
          await safeRefresh(refreshProducts, 'Failed to refresh products.');
          await safeRefresh(refreshSales, 'Failed to refresh sales.');
          setSuccessMessage('Sale card created and stock updated.');
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
            'Sale',
          )
        ) {
          await safeRefresh(refreshProducts, 'Failed to refresh products.');
          return;
        }
        setError(getRequestErrorMessage(requestError, 'Failed to save sale.'));
      } finally {
        setIsSaleSaving(false);
      }
    },
    saveEmployee: async () => {
      setIsEmployeeSaving(true);
      clearNotifications();
      try {
        if (editingEmployeeId) {
          const updatedEmployee = await updateEmployee(editingEmployeeId, employeeForm);
          setAllEmployees((current) =>
            current.map((item) =>
              item.id === updatedEmployee.id ? updatedEmployee : item,
            ),
          );
          setSuccessMessage('Employee updated.');
        } else {
          const createdEmployee = await createEmployee(employeeForm);
          setAllEmployees((current) => [createdEmployee, ...current]);
          setSuccessMessage('Employee created.');
        }
        resetEmployeeEditor();
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to save employee.'));
      } finally {
        setIsEmployeeSaving(false);
      }
    },
    saveSettings: async () => {
      setIsSettingsSaving(true);
      clearNotifications();
      try {
        const updated = await updateSettings(settingsForm);
        setSettings(updated);
        setSettingsForm({
          serviceName: updated.serviceName,
          company: updated.company,
          companyAddress: updated.companyAddress,
          companyId: updated.companyId,
          companyIban: updated.companyIban,
          printForms: updated.printForms,
          orderDefaults: updated.orderDefaults,
          numbering: updated.numbering,
          financeDefaults: updated.financeDefaults,
          notificationSettings: updated.notificationSettings,
        });
        setSuccessMessage('Settings saved.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to save settings.'));
      } finally {
        setIsSettingsSaving(false);
      }
    },
    deleteProduct: async (product: Product) => {
      clearNotifications();
      if (!window.confirm(`Delete product "${product.name}"?`)) return;

      try {
        await mutateDeleteProduct(product.id);
        setAllProducts((current) => current.filter((item) => item.id !== product.id));
        await safeRefresh(refreshProducts, 'Failed to refresh products.');
        if (editingProductId === product.id) resetProductEditor();
        setSuccessMessage('Product deleted.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to delete product.'));
      }
    },
    archiveProduct: async (product: Product) => {
      clearNotifications();
      if (
        !window.confirm(
          `Alarm: delete or deactivate product "${product.name}"? This action depends on stock and order history.`,
        )
      ) return;

      try {
        const result = await mutateArchiveProduct(product.id);
        if (result.action === 'deleted') {
          setAllProducts((current) => current.filter((item) => item.id !== product.id));
          await safeRefresh(refreshProducts, 'Failed to refresh products.');
          if (editingProductId === product.id) resetProductEditor();
          setSuccessMessage('Product deleted.');
          return;
        }

        setAllProducts((current) =>
          current.map((item) =>
            item.id === result.product.id ? result.product : item,
          ),
        );
        await safeRefresh(refreshProducts, 'Failed to refresh products.');
        setSuccessMessage('Product deactivated.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to delete or deactivate product.'));
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
        setAllProducts((current) =>
          current.map((item) =>
            item.id === updatedProduct.id ? updatedProduct : item,
          ),
        );
        await safeRefresh(refreshProducts, 'Failed to refresh products.');
        if (editingProductId === updatedProduct.id) {
          setProductForm(toProductForm(updatedProduct));
        }
        setSuccessMessage('Product activated.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to activate product.'));
      } finally {
        setIsProductSaving(false);
      }
    },
    deleteService: async (service: ServiceCatalogItem) => {
      clearNotifications();
      if (!window.confirm(`Delete service "${service.name}"?`)) return;

      try {
        await mutateDeleteService(service.id);
        setServices((current) => current.filter((item) => item.id !== service.id));
        if (editingServiceId === service.id) resetServiceEditor();
        setSuccessMessage('Service deleted.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to delete service.'));
      }
    },
    archiveService: async (service: ServiceCatalogItem) => {
      clearNotifications();
      if (
        !window.confirm(
          `Alarm: delete or deactivate service "${service.name}"? Used services will be deactivated instead of deleted.`,
        )
      ) return;

      try {
        const result = await mutateArchiveService(service.id);
        if (result.action === 'deleted') {
          setServices((current) => current.filter((item) => item.id !== service.id));
          if (editingServiceId === service.id) resetServiceEditor();
          setSuccessMessage('Service deleted.');
          return;
        }

        setServices((current) =>
          current.map((item) =>
            item.id === result.service.id ? result.service : item,
          ),
        );
        setSuccessMessage('Service deactivated.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to delete or deactivate service.'));
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
        setServices((current) =>
          current.map((item) =>
            item.id === updatedService.id ? updatedService : item,
          ),
        );
        if (editingServiceId === updatedService.id) {
          setServiceForm(toServiceCatalogForm(updatedService));
        }
        setSuccessMessage('Service activated.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to activate service.'));
      } finally {
        setIsServiceSaving(false);
      }
    },
    deleteClient: async (client: Client) => {
      clearNotifications();
      const hasSalesHistory = sales.some((sale) => sale.client.id === client.id);
      if (hasSalesHistory) {
        setError('Клієнта не можна видалити, бо він має замовлення або продажі.');
        return;
      }
      if (!window.confirm(`Видалити клієнта "${client.name}"?`)) return;

      try {
        await mutateDeleteClient(client.id);
        setAllClients((current) => current.filter((item) => item.id !== client.id));
        if (selectedClientId === client.id) {
          setSelectedClientId(null);
          setClientHistory(null);
        }
        if (editingClientId === client.id) resetClientEditor();
        setSuccessMessage('Клієнта видалено.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Не вдалося видалити клієнта.'));
      }
    },
    deleteSale: async (sale: Sale) => {
      clearNotifications();
      if (!window.confirm(`Delete sale for "${sale.product.name}"?`)) return;

      try {
        await mutateDeleteSale(sale.id);
        setSales((current) => current.filter((item) => item.id !== sale.id));
        await safeRefresh(refreshProducts, 'Failed to refresh products.');
        await safeRefresh(refreshSales, 'Failed to refresh sales.');
        if (editingSaleId === sale.id) resetSaleEditor();
        if (selectedClientId === sale.client.id) await refreshClientHistory(sale.client.id);
        setSuccessMessage('Sale deleted and stock restored.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to delete sale.'));
      }
    },
    deleteEmployee: async (employee: Employee) => {
      clearNotifications();

      if (currentEmployee?.id === employee.id) {
        setError('You cannot delete your own account.');
        return;
      }

      try {
        await deleteEmployee(employee.id);
        setAllEmployees((current) => current.filter((item) => item.id !== employee.id));
        if (editingEmployeeId === employee.id) resetEmployeeEditor();
        setSuccessMessage('Employee deleted.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to delete employee.'));
      }
    },
    exportProducts: async () => {
      setIsExporting(true);
      clearNotifications();
      try {
        await exportProducts();
        setSuccessMessage('Product export prepared.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to export products.'));
      } finally {
        setIsExporting(false);
      }
    },
    seedDemoData: async (kind: DemoSeedKind = 'all') => {
      setIsSeeding(true);
      clearNotifications();
      try {
        const result = await seedDemoData(kind);
        setAllProducts(result.products);
        setCatalogProducts([]);
        setAllClients(result.clients);
        setSales(result.sales);
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
        setError(getRequestErrorMessage(requestError, 'Failed to seed demo data.'));
      } finally {
        setIsSeeding(false);
      }
    },
    updateClientDeviceCard: async (deviceId: string, payload: ClientDeviceFormValues) => {
      setIsProductSaving(true);
      clearNotifications();
      try {
        await mutateUpdateClientDevice(deviceId, payload);
        await safeRefresh(refreshClientDevices, 'Failed to refresh client devices.');
        setSuccessMessage('Client device updated.');
        return true;
      } catch (requestError) {
        if (
          await handleOptimisticConflict(
            requestError,
            refreshClientDevices,
            'Client device',
          )
        ) {
          return false;
        }
        setError(getRequestErrorMessage(requestError, 'Failed to update client device.'));
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
        await safeRefresh(refreshClientDevices, 'Failed to refresh client devices.');
        setSuccessMessage('Client device removed.');
        return true;
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to remove client device.'));
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
        setAllProducts(result.products);
        setCatalogProducts([]);
        setAllClients(result.clients);
        setSales(result.sales);
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
        setError(getRequestErrorMessage(requestError, 'Failed to erase data.'));
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
        const primarySaleItem = payload.sourceTab === 'sale' ? saleItems[0] : null;
        const deviceName =
          payload.sourceTab === 'sale'
            ? primarySaleItem?.name ?? ''
            : payload.deviceName.trim();
        const estimatedCost =
          payload.sourceTab === 'sale' && saleItems.length > 0
            ? saleItems.reduce((total, item) => total + item.price * item.quantity, 0)
            : Number.parseFloat(payload.estimatedCost || '0');

        if (normalizedPhone.replace(/\D/g, '').length < 12) {
          throw new Error('Client phone must include full +380 number.');
        }
        if (clientName.length < 2) {
          throw new Error('Client name must contain at least 2 characters.');
        }
        if (deviceName.length < 2) {
          throw new Error('Device name must contain at least 2 characters.');
        }
        if (!payload.managerId.trim()) {
          throw new Error('Manager must be selected from the current logged in employee.');
        }
        if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
          throw new Error('Estimated cost must be a non-negative number.');
        }
        if (
          payload.sourceTab === 'sale' &&
          saleItems.some((item) => item.productId && item.quantity < 1)
        ) {
          throw new Error('Sale item quantity must be at least 1.');
        }
        const existingClient = allClients.find(
          (client) =>
            client.phone.replace(/\D/g, '') === normalizedPhone.replace(/\D/g, ''),
        );
        const client =
          existingClient ??
          (await mutateCreateClient({
            phone: normalizedPhone,
            name: clientName,
            note: payload.discountCode ? `Discount code: ${payload.discountCode.trim()}` : '',
            status: 'new',
          }));

        if (!existingClient) {
          setAllClients((current) => [client, ...current]);
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
        const author = currentEmployee?.name ?? managerName ?? 'System';

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
        const lineItems =
          payload.sourceTab === 'sale' && saleItems.length > 0
            ? buildCreateOrderSaleLineItems(
                saleItems.map((item) => ({
                  id: item.id || crypto.randomUUID(),
                  productId: item.productId,
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

        await mutateCreateSale({
          saleDate: formatOrderDateTime(payload.readyDate, payload.readyTime),
          clientId: client.id,
          productId: '',
          quantity: String(payload.sourceTab === 'sale' && primarySaleItem ? primarySaleItem.quantity : 1),
          salePrice: String(estimatedCost),
          kind: payload.sourceTab,
          status: 'new',
          paidAmount: 0,
          note: noteParts.join('\n'),
          managerId: payload.managerId,
          masterId: payload.sourceTab === 'repair' ? payload.masterId : '',
          deviceName: payload.sourceTab === 'repair' ? deviceName : '',
          serialNumber: payload.sourceTab === 'repair' ? serialNumber : '',
          timeline: [
            ...(payload.issueFromClient.trim()
              ? [
                  {
                    id: crypto.randomUUID(),
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
        await safeRefresh(refreshProducts, 'Failed to refresh products.');
        await safeRefresh(refreshSales, 'Failed to refresh sales.');
        await safeRefresh(refreshClientDevices, 'Failed to refresh client devices.');
        setSuccessMessage('Order saved successfully.');
        return true;
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to save order.'));
        return false;
      } finally {
        setIsSaleSaving(false);
      }
    },
  };
};

