import { useDeferredValue, useState } from 'react';
import { initialClientForm } from '../../../entities/client/model/forms';
import type { Client, ClientFormValues, ClientHistory, ClientStatus } from '../../../entities/client/model/types';
import {
  filterClientsByQuery,
  filterClientsByStatus,
} from '../../../entities/client/lib/filter-clients';
import { initialProductForm } from '../../../entities/product/model/forms';
import type { Product, ProductFormValues } from '../../../entities/product/model/types';
import { filterProducts } from '../../../entities/product/lib/filter-products';
import { initialSaleForm } from '../../../entities/sale/model/forms';
import type { Sale, SaleFormValues } from '../../../entities/sale/model/types';
import { createDashboardActions } from './dashboard-actions';
import { useDashboardEffects } from './use-dashboard-effects';
import type { StatsPeriod } from '../../../widgets/dashboard/model/sales-analytics';

export const useDashboardPage = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('today');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientHistory, setClientHistory] = useState<ClientHistory | null>(null);
  const [productForm, setProductForm] = useState<ProductFormValues>(initialProductForm);
  const [clientForm, setClientForm] = useState<ClientFormValues>(initialClientForm);
  const [saleForm, setSaleForm] = useState<SaleFormValues>(initialSaleForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatus | 'all'>('all');
  const deferredProductSearchQuery = useDeferredValue(productSearchQuery.trim());
  const deferredClientSearchQuery = useDeferredValue(clientSearchQuery.trim());
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isClientsLoading, setIsClientsLoading] = useState(true);
  const [isSalesLoading, setIsSalesLoading] = useState(true);
  const [isClientHistoryLoading, setIsClientHistoryLoading] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);
  const [isClientSaving, setIsClientSaving] = useState(false);
  const [isSaleSaving, setIsSaleSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useDashboardEffects({
    selectedClientId,
    setAllProducts,
    setAllClients,
    setSales,
    setClientHistory,
    setIsProductsLoading,
    setIsClientsLoading,
    setIsSalesLoading,
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
    productForm,
    clientForm,
    saleForm,
    editingProductId,
    editingClientId,
    editingSaleId,
    selectedClientId,
    setAllProducts,
    setAllClients,
    setSales,
    setSelectedClientId,
    setClientHistory,
    setProductForm,
    setClientForm,
    setSaleForm,
    setEditingProductId,
    setEditingClientId,
    setEditingSaleId,
    setProductSearchQuery,
    setClientSearchQuery,
    setClientStatusFilter,
    setIsProductSaving,
    setIsClientSaving,
    setIsSaleSaving,
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
      statsPeriod,
      products,
      clients,
      clientHistory,
      selectedClientId,
      productForm,
      clientForm,
      saleForm,
      editingProductId,
      editingClientId,
      editingSaleId,
      productSearchQuery,
      clientSearchQuery,
      clientStatusFilter,
      deferredProductSearchQuery,
      deferredClientSearchQuery,
      totalFreeStock,
      isProductsLoading,
      isClientsLoading,
      isSalesLoading,
      isClientHistoryLoading,
      isProductSaving,
      isClientSaving,
      isSaleSaving,
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
