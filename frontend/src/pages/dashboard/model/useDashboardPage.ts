import { useDeferredValue, useState } from 'react';
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
import type { AppSettings, AppSettingsFormValues } from '../../../entities/settings/model/types';
import { createDashboardActions } from './dashboard-actions';
import { useDashboardEffects } from './use-dashboard-effects';
import type { StatsPeriod } from '../../../widgets/dashboard/model/sales-analytics';

export const useDashboardPage = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<AppSettingsFormValues>({
    serviceName: 'Service CRM',
  });
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('today');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientHistory, setClientHistory] = useState<ClientHistory | null>(null);
  const [productForm, setProductForm] = useState<ProductFormValues>(initialProductForm);
  const [clientForm, setClientForm] = useState<ClientFormValues>(initialClientForm);
  const [saleForm, setSaleForm] = useState<SaleFormValues>(initialSaleForm);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormValues>(initialEmployeeForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatus | 'all'>('all');
  const deferredProductSearchQuery = useDeferredValue(productSearchQuery.trim());
  const deferredClientSearchQuery = useDeferredValue(clientSearchQuery.trim());
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isClientsLoading, setIsClientsLoading] = useState(true);
  const [isSalesLoading, setIsSalesLoading] = useState(true);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true);
  const [isClientHistoryLoading, setIsClientHistoryLoading] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);
  const [isClientSaving, setIsClientSaving] = useState(false);
  const [isSaleSaving, setIsSaleSaving] = useState(false);
  const [isEmployeeSaving, setIsEmployeeSaving] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useDashboardEffects({
    selectedClientId,
    setAllProducts,
    setAllClients,
    setSales,
    setAllEmployees,
    setSettings,
    setSettingsForm,
    setClientHistory,
    setIsProductsLoading,
    setIsClientsLoading,
    setIsSalesLoading,
    setIsEmployeesLoading,
    setIsClientHistoryLoading,
    setError,
  });

  const products = filterProducts(allProducts, deferredProductSearchQuery);
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
    allEmployees,
    settingsForm,
    productForm,
    clientForm,
    saleForm,
    employeeForm,
    editingProductId,
    editingClientId,
    editingSaleId,
    editingEmployeeId,
    selectedClientId,
    setAllProducts,
    setAllClients,
    setSales,
    setAllEmployees,
    setSettings,
    setSettingsForm,
    setSelectedClientId,
    setClientHistory,
    setProductForm,
    setClientForm,
    setSaleForm,
    setEmployeeForm,
    setEditingProductId,
    setEditingClientId,
    setEditingSaleId,
    setEditingEmployeeId,
    setProductSearchQuery,
    setClientSearchQuery,
    setClientStatusFilter,
    setIsProductSaving,
    setIsClientSaving,
    setIsSaleSaving,
    setIsEmployeeSaving,
    setIsSettingsSaving,
    setIsExporting,
    setIsSeeding,
    setError,
    setSuccessMessage,
  });

  return {
    state: {
      allProducts,
      allClients,
      sales,
      allEmployees,
      settings,
      settingsForm,
      statsPeriod,
      products,
      clients,
      clientHistory,
      selectedClientId,
      productForm,
      clientForm,
      saleForm,
      employeeForm,
      editingProductId,
      editingClientId,
      editingSaleId,
      editingEmployeeId,
      productSearchQuery,
      clientSearchQuery,
      clientStatusFilter,
      deferredProductSearchQuery,
      deferredClientSearchQuery,
      totalFreeStock,
      isProductsLoading,
      isClientsLoading,
      isSalesLoading,
      isEmployeesLoading,
      isClientHistoryLoading,
      isProductSaving,
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
    },
  };
};
