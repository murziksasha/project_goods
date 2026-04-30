import {
  createClient,
  deleteClient,
  getClientHistory,
  mergeClients as mergeClientsApi,
  updateClient,
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
  archiveProduct,
  createProduct,
  deleteProduct,
  exportProducts,
  getProducts,
  updateProduct,
} from '../../../entities/product/api/productApi';
import { initialProductForm, toProductForm } from '../../../entities/product/model/forms';
import type { Product, ProductFormValues } from '../../../entities/product/model/types';
import { createSale, deleteSale, updateSale } from '../../../entities/sale/api/saleApi';
import { initialSaleForm, toSaleForm } from '../../../entities/sale/model/forms';
import type { Sale, SaleFormValues } from '../../../entities/sale/model/types';
import {
  archiveServiceCatalogItem,
  createServiceCatalogItem,
  deleteServiceCatalogItem,
  updateServiceCatalogItem,
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
import type {
  AppSettings,
  AppSettingsFormValues,
} from '../../../entities/settings/model/types';
import { seedDemoData, type DemoSeedKind } from '../../../features/demo-data/api/demoApi';
import { getRequestErrorMessage } from '../../../shared/lib/request';
import type { CreateOrderRequestPayload } from '../../../widgets/dashboard/model/order-request';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

type DashboardActionParams = {
  allProducts: Product[];
  allServices: ServiceCatalogItem[];
  allClients: Client[];
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
  setAllClients: Setter<Client[]>;
  setAllEmployees: Setter<Employee[]>;
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
};

export const createDashboardActions = ({
  allProducts,
  allServices,
  allClients,
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
  setAllClients,
  setAllEmployees,
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
          const updatedProduct = await updateProduct(editingProductId, productForm);
          setAllProducts((current) =>
            current.map((item) => (item.id === updatedProduct.id ? updatedProduct : item)),
          );
          setSuccessMessage('Product updated.');
        } else {
          const createdProduct = await createProduct(productForm);
          setAllProducts((current) => [createdProduct, ...current]);
          setSuccessMessage('Product saved to MongoDB.');
        }

        resetProductEditor();
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to save product.'));
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
          const updatedService = await updateServiceCatalogItem(
            editingServiceId,
            serviceForm,
          );
          setServices((current) =>
            current.map((item) =>
              item.id === updatedService.id ? updatedService : item,
            ),
          );
          setSuccessMessage('Service updated.');
        } else {
          const createdService = await createServiceCatalogItem(serviceForm);
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
          const updatedClient = await updateClient(editingClientId, clientForm);
          setAllClients((current) =>
            current.map((item) => (item.id === updatedClient.id ? updatedClient : item)),
          );
          if (selectedClientId === updatedClient.id) {
            setSelectedClientId(updatedClient.id);
          }
          setSuccessMessage('Клієнта оновлено.');
        } else {
          const createdClient = await createClient(clientForm);
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
        const createdClient = await createClient(payload);
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
    updateClientCard: async (clientId: string, payload: ClientFormValues) => {
      setIsClientSaving(true);
      clearNotifications();

      try {
        const updatedClient = await updateClient(clientId, payload);
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
          const result = await updateSale(editingSaleId, saleForm);
          setSales((current) =>
            current.map((sale) => (sale.id === result.sale.id ? result.sale : sale)),
          );
          setAllProducts(await getProducts());
          setSuccessMessage('Sale updated and stock recalculated.');
        } else {
          const result = await createSale(saleForm);
          setSales((current) => [result.sale, ...current]);
          setAllProducts(
            allProducts.map((item) => (item.id === result.product.id ? result.product : item)),
          );
          setSuccessMessage('Sale card created and stock updated.');
        }

        resetSaleEditor();
        if (selectedClientId) {
          await refreshClientHistory(selectedClientId);
        }
      } catch (requestError) {
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
        setSettingsForm({ serviceName: updated.serviceName });
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
        await deleteProduct(product.id);
        setAllProducts((current) => current.filter((item) => item.id !== product.id));
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
        const result = await archiveProduct(product.id);
        if (result.action === 'deleted') {
          setAllProducts((current) => current.filter((item) => item.id !== product.id));
          if (editingProductId === product.id) resetProductEditor();
          setSuccessMessage('Product deleted.');
          return;
        }

        setAllProducts((current) =>
          current.map((item) =>
            item.id === result.product.id ? result.product : item,
          ),
        );
        setSuccessMessage('Product deactivated.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to delete or deactivate product.'));
      }
    },
    deleteService: async (service: ServiceCatalogItem) => {
      clearNotifications();
      if (!window.confirm(`Delete service "${service.name}"?`)) return;

      try {
        await deleteServiceCatalogItem(service.id);
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
        const result = await archiveServiceCatalogItem(service.id);
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
    deleteClient: async (client: Client) => {
      clearNotifications();
      const hasSalesHistory = sales.some((sale) => sale.client.id === client.id);
      if (hasSalesHistory) {
        setError('Клієнта не можна видалити, бо він має замовлення або продажі.');
        return;
      }
      if (!window.confirm(`Видалити клієнта "${client.name}"?`)) return;

      try {
        await deleteClient(client.id);
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
        await deleteSale(sale.id);
        setSales((current) => current.filter((item) => item.id !== sale.id));
        setAllProducts(await getProducts());
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
    saveOrderRequest: async (payload: CreateOrderRequestPayload) => {
      setIsSaleSaving(true);
      clearNotifications();

      try {
        const normalizedPhone = normalizePhone(payload.clientPhone);
        const clientName = payload.clientName.trim();
        const saleItems = (payload.saleItems ?? [])
          .map((item) => {
            const quantity = Number.parseInt(item.quantity || '1', 10);
            const price = Number.parseFloat(item.price || '0');
            const warrantyPeriod = Number.parseInt(item.warrantyPeriod || '0', 10);

            return {
              ...item,
              name: item.name.trim(),
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
        const prepaymentAmount = Number.parseFloat(payload.prepayment || '0');

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
        if (Number.isFinite(prepaymentAmount) && prepaymentAmount > estimatedCost) {
          throw new Error('Prepayment cannot exceed order total.');
        }

        const existingClient = allClients.find(
          (client) =>
            client.phone.replace(/\D/g, '') === normalizedPhone.replace(/\D/g, ''),
        );
        const client =
          existingClient ??
          (await createClient({
            phone: normalizedPhone,
            name: clientName,
            note: payload.discountCode ? `Discount code: ${payload.discountCode.trim()}` : '',
            status: 'new',
          }));

        if (!existingClient) {
          setAllClients((current) => [client, ...current]);
        }

        const { serialNumber, article } = buildProductIdentity(payload);
        const existingProduct =
          payload.sourceTab === 'sale' && primarySaleItem?.productId
            ? allProducts.find((product) => product.id === primarySaleItem.productId)
            : allProducts.find(
                (product) => product.serialNumber.toUpperCase() === serialNumber,
              );

        let product = existingProduct;
        if (!product) {
          const fallbackPrice =
            payload.sourceTab === 'sale' && primarySaleItem
              ? primarySaleItem.price
              : estimatedCost;
          const fallbackQuantity =
            payload.sourceTab === 'sale' && primarySaleItem
              ? String(primarySaleItem.quantity)
              : '1';
          product = await createProduct({
            name: deviceName,
            article: primarySaleItem?.article || article,
            serialNumber: primarySaleItem?.serialNumber || serialNumber,
            price: String(fallbackPrice),
            salePriceOptions: String(fallbackPrice),
            quantity: fallbackQuantity,
            note:
              payload.sourceTab === 'sale'
                ? 'Ordered from sale request'
                : [payload.deviceColor, payload.deviceKit, payload.repairType]
                    .filter(Boolean)
                    .join(' | '),
            purchasePlace: '',
            purchaseDate: '',
            warrantyPeriod: '0',
          });
          setAllProducts((current) => [product!, ...current]);
        }

        const managerName = allEmployees.find((employee) => employee.id === payload.managerId)?.name ?? '';
        const masterName = allEmployees.find((employee) => employee.id === payload.masterId)?.name ?? '';
        const createdAt = new Date().toISOString();
        const author = currentEmployee?.name ?? managerName ?? 'System';
        const normalizedPrepayment =
          Number.isFinite(prepaymentAmount) && prepaymentAmount > 0
            ? Math.round(prepaymentAmount * 100) / 100
            : 0;
        const prepaymentMessage =
          normalizedPrepayment > 0
            ? `кассы ОСНОВНАЯ : ${normalizedPrepayment} uah${
                payload.prepaymentComment.trim()
                  ? `, ${payload.prepaymentComment.trim()}`
                  : ''
              }`
            : '';

        const noteParts = [
          payload.issueFromClient.trim(),
          payload.sourceTab === 'repair' ? payload.externalView.trim() : '',
          payload.prepayment ? `Prepayment: ${payload.prepayment}` : '',
          prepaymentMessage,
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
            ? saleItems.map((item, index) => ({
                id: item.id || crypto.randomUUID(),
                kind: 'product' as const,
                productId: item.productId || (index === 0 ? product.id : ''),
                name: item.warehouse
                  ? `${item.name} (${item.warehouse})`
                  : item.name,
                price: item.price,
                quantity: item.quantity,
                warrantyPeriod: item.warrantyPeriod,
              }))
            : [
                {
                  id: crypto.randomUUID(),
                  kind: 'service' as const,
                  productId: '',
                  name: payload.serviceName.trim() || 'Repair',
                  price: estimatedCost,
                  quantity: 1,
                  warrantyPeriod: 1,
                },
              ];

        const saleResult = await createSale({
          saleDate: formatOrderDateTime(payload.readyDate, payload.readyTime),
          clientId: client.id,
          productId: product.id,
          quantity: String(
            payload.sourceTab === 'sale' && primarySaleItem
              ? primarySaleItem.quantity
              : 1,
          ),
          salePrice: String(estimatedCost),
          kind: payload.sourceTab,
          status: 'new',
          paidAmount: normalizedPrepayment,
          note: noteParts.join('\n'),
          managerId: payload.managerId,
          masterId: payload.sourceTab === 'repair' ? payload.masterId : '',
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
            ...(prepaymentMessage
              ? [
                  {
                    id: crypto.randomUUID(),
                    author,
                    message: prepaymentMessage,
                    createdAt,
                  },
                ]
              : []),
          ],
          paymentHistory:
            normalizedPrepayment > 0
              ? [
                  {
                    id: crypto.randomUUID(),
                    type: 'deposit',
                    amount: normalizedPrepayment,
                    cashboxId: 'main',
                    cashboxName: 'ОСНОВНАЯ',
                    author,
                    createdAt,
                  },
                ]
              : [],
          lineItems,
        });

        setSales((current) => [saleResult.sale, ...current]);
        setAllProducts(await getProducts());
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
