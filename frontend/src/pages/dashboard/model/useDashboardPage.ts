import { useDeferredValue, useEffect, useState } from 'react';
import { initialClientForm } from '../../../entities/client/model/forms';
import type { Client, ClientFormValues, ClientHistory, ClientStatus } from '../../../entities/client/model/types';
import { initialEmployeeForm } from '../../../entities/employee/model/forms';
import type { Employee, EmployeeFormValues } from '../../../entities/employee/model/types';
import {
  filterClientsByQuery,
  filterClientsByStatus,
} from '../../../entities/client/lib/filter-clients';
import { initialProductForm } from '../../../entities/product/model/forms';
import type { Product, ProductFormValues } from '../../../entities/product/model/types';
import { filterProducts } from '../../../entities/product/lib/filter-products';
import { initialSaleForm } from '../../../entities/sale/model/forms';
import type { Sale, SaleFormValues } from '../../../entities/sale/model/types';
import { initialServiceCatalogForm } from '../../../entities/service-catalog/model/forms';
import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from '../../../entities/service-catalog/model/types';
import type { AppSettings, AppSettingsFormValues } from '../../../entities/settings/model/types';
import { createDashboardActions } from './dashboard-actions';
import { useDashboardEffects } from './use-dashboard-effects';
import type { StatsPeriod } from '../../../widgets/dashboard/model/sales-analytics';

export const useDashboardPage = (enabled = true, currentEmployee: Employee | null = null) => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
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

  useDashboardEffects({
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
  });

  return {
    state: {
      allProducts: enabled ? allProducts : [],
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
    },
    actions: {
      ...actions,
      setStatsPeriod,
      showError: setError,
      showSuccessMessage: setSuccessMessage,
    },
  };
};
