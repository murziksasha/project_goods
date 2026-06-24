import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../shared/i18n/config';
import type { Employee } from '../../../entities/employee/model/types';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { ClientDeviceFormValues } from '../../../entities/client-device/model/types';
import type {
  CatalogProduct,
  CatalogProductFormValues,
} from '../../../entities/catalog-product/model/types';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import type {
  Product,
  ProductFormValues,
} from '../../../entities/product/model/types';
import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from '../../../entities/service-catalog/model/types';
import { ServiceCatalogForm } from '../../../features/manage-service-catalog/ui/ServiceCatalogForm';
import {
  CompactPaginationPanel,
  PaginationPanel,
} from '../../../shared/ui/PaginationPanel';
import {
  CatalogProductsTable,
  ProductsTable,
  ServicesTable,
  SuppliersTable,
} from './ProductCatalogTables';
import {
  CatalogServiceModal,
  CatalogSuggestionProductModal,
  ClientDeviceModal,
  SupplierModal,
} from './ProductCatalogModals';
import {
  catalogTabStorageKey,
  catalogActiveFiltersStorageKey,
  catalogSavedFiltersStorageKey,
  emptyCatalogFilters,
  getActiveCatalogFiltersCount,
  isDateInCatalogRange,
  normalizeCatalogFilters,
  parseCatalogNumberFilter,
  readCatalogActiveFilters,
  tabs,
  type CatalogTab,
  type CatalogFilters,
} from './product-catalog-shared';
import { filterIconOptions } from './orders-workspace-shared';
import {
  createSavedFilterId,
  readSavedFilters,
  type SavedFilter,
} from '../model/saved-filters';
import { SavedFiltersPanel } from './SavedFiltersPanel';

export { CatalogProductModal } from './ProductCatalogModals';

type ProductCatalogPanelProps = {
  currentEmployee: Employee | null;
  products: Product[];
  clientDevices: ClientDevice[];
  catalogProducts: CatalogProduct[];
  isCatalogProductsLoading: boolean;
  isLoading: boolean;
  searchQuery: string;
  currentSearchValue: string;
  productForm: ProductFormValues;
  isProductSaving: boolean;
  isProductEditing: boolean;
  onSearchChange: (value: string) => void;
  onProductChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
  onProductSubmit: () => void | Promise<void>;
  onProductCancelEdit: () => void;
  onArchiveProduct: (product: Product) => void;
  onActivateProduct: (product: Product) => void | Promise<void>;
  services: ServiceCatalogItem[];
  serviceForm: ServiceCatalogFormValues;
  isServicesLoading: boolean;
  isServiceSaving: boolean;
  isServiceEditing: boolean;
  serviceSearchQuery: string;
  currentServiceSearchValue: string;
  onServiceSearchChange: (value: string) => void;
  onServiceChange: <K extends keyof ServiceCatalogFormValues>(
    field: K,
    value: ServiceCatalogFormValues[K],
  ) => void;
  onServiceSubmit: () => void | Promise<void>;
  onServiceCancelEdit: () => void;
  onServiceEdit: (service: ServiceCatalogItem) => void;
  onServiceArchive: (service: ServiceCatalogItem) => void;
  onServiceActivate: (service: ServiceCatalogItem) => void | Promise<void>;
  suppliers: Supplier[];
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onUpdateSupplier: (clientId: string, payload: SupplierFormValues) => Promise<boolean>;
  onCreateClientDevice: (payload: ClientDeviceFormValues) => Promise<boolean>;
  onUpdateClientDevice: (deviceId: string, payload: ClientDeviceFormValues) => Promise<boolean>;
  onDeleteClientDevice: (deviceId: string) => Promise<boolean>;
  onUpdateCatalogProduct: (
    catalogProductId: string,
    payload: CatalogProductFormValues,
  ) => Promise<boolean>;
  onCreateCatalogProduct: (payload: CatalogProductFormValues) => Promise<boolean>;
  onDeleteCatalogProduct: (catalogProductId: string) => Promise<boolean>;
};

export const ProductCatalogPanel = ({
  currentEmployee,
  products,
  clientDevices,
  catalogProducts,
  isCatalogProductsLoading,
  isLoading,
  searchQuery,
  currentSearchValue,
  productForm,
  isProductSaving,
  isProductEditing,
  onSearchChange,
  onProductChange,
  onProductSubmit,
  onProductCancelEdit,
  onArchiveProduct,
  onActivateProduct,
  services,
  serviceForm,
  isServicesLoading,
  isServiceSaving,
  isServiceEditing,
  serviceSearchQuery,
  currentServiceSearchValue,
  onServiceSearchChange,
  onServiceChange,
  onServiceSubmit,
  onServiceCancelEdit,
  onServiceEdit,
  onServiceArchive,
  onServiceActivate,
  suppliers,
  onCreateSupplier,
  onUpdateSupplier,
  onCreateClientDevice,
  onUpdateClientDevice,
  onDeleteClientDevice,
  onUpdateCatalogProduct,
  onCreateCatalogProduct,
  onDeleteCatalogProduct,
}: ProductCatalogPanelProps) => {
  void productForm;
  void isProductSaving;
  void isProductEditing;
  void onProductChange;
  void onProductSubmit;
  void onProductCancelEdit;
  void onArchiveProduct;
  void onActivateProduct;

  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<CatalogTab>(() => {
    const storedTab = window.localStorage.getItem(catalogTabStorageKey);
    return storedTab === 'products' || storedTab === 'catalogProducts' || storedTab === 'services' || storedTab === 'suppliers'
      ? storedTab
      : 'products';
  });
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize, setProductsPageSize] = useState(30);
  const [catalogProductsPage, setCatalogProductsPage] = useState(1);
  const [catalogProductsPageSize, setCatalogProductsPageSize] = useState(30);
  const [servicesPage, setServicesPage] = useState(1);
  const [servicesPageSize, setServicesPageSize] = useState(30);
  const [suppliersPage, setSuppliersPage] = useState(1);
  const [suppliersPageSize, setSuppliersPageSize] = useState(30);
  const [selectedService, setSelectedService] = useState<ServiceCatalogItem | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedClientDevice, setSelectedClientDevice] = useState<ClientDevice | null>(null);
  const [selectedCatalogProduct, setSelectedCatalogProduct] =
    useState<CatalogProduct | null>(null);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [draftFiltersByTab, setDraftFiltersByTab] = useState<
    Record<CatalogTab, CatalogFilters>
  >(readCatalogActiveFilters);
  const [appliedFiltersByTab, setAppliedFiltersByTab] = useState<
    Record<CatalogTab, CatalogFilters>
  >(readCatalogActiveFilters);
  const [savedFilters, setSavedFilters] = useState<
    Array<SavedFilter<CatalogFilters, CatalogTab>>
  >(() =>
    readSavedFilters<CatalogFilters, CatalogTab>(
      catalogSavedFiltersStorageKey,
      tabs.map((tab) => tab.key),
    ),
  );
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterIcon, setNewFilterIcon] = useState(filterIconOptions[0]);
  const [isCreateDeviceModalOpen, setIsCreateDeviceModalOpen] = useState(false);
  const [isCreateSupplierModalOpen, setIsCreateSupplierModalOpen] = useState(false);
  const [isCreateCatalogProductModalOpen, setIsCreateCatalogProductModalOpen] = useState(false);
  const [isCreateCatalogProductSaving, setIsCreateCatalogProductSaving] = useState(false);
  const [createDeviceForm, setCreateDeviceForm] = useState({
    name: '',
    note: '',
  });
  const [createCatalogProductForm, setCreateCatalogProductForm] = useState({
    name: '',
    note: '',
  });
  const [createSupplierForm, setCreateSupplierForm] = useState({
    name: '',
    phone: '+380',
    note: '',
  });
  const isProductsTab = activeTab === 'products';
  const isCatalogProductsTab = activeTab === 'catalogProducts';
  const isSuppliersTab = activeTab === 'suppliers';
  const draftFilters = draftFiltersByTab[activeTab] ?? emptyCatalogFilters;
  const appliedFilters = appliedFiltersByTab[activeTab] ?? emptyCatalogFilters;
  const activeFiltersCount = getActiveCatalogFiltersCount(appliedFilters);
  const visibleSavedFilters = useMemo(
    () =>
      currentEmployee?.id
        ? savedFilters
            .filter(
              (item) =>
                item.employeeId === currentEmployee.id &&
                item.tab === activeTab,
            )
            .sort(
              (first, second) =>
                new Date(second.createdAt).getTime() -
                new Date(first.createdAt).getTime(),
            )
        : [],
    [activeTab, currentEmployee?.id, savedFilters],
  );
  const resetActivePage = () => {
    if (activeTab === 'products') {
      setProductsPage(1);
    } else if (activeTab === 'catalogProducts') {
      setCatalogProductsPage(1);
    } else if (activeTab === 'suppliers') {
      setSuppliersPage(1);
    } else {
      setServicesPage(1);
    }
  };
  const updateDraftFilter = <K extends keyof CatalogFilters>(
    field: K,
    value: CatalogFilters[K],
  ) => {
    setDraftFiltersByTab((current) => ({
      ...current,
      [activeTab]: {
        ...(current[activeTab] ?? emptyCatalogFilters),
        [field]: value,
      },
    }));
  };
  const applyFilters = () => {
    const nextFilters = normalizeCatalogFilters(draftFilters);
    setDraftFiltersByTab((current) => ({
      ...current,
      [activeTab]: nextFilters,
    }));
    setAppliedFiltersByTab((current) => ({
      ...current,
      [activeTab]: nextFilters,
    }));
    resetActivePage();
  };
  const clearFilters = () => {
    setDraftFiltersByTab((current) => ({
      ...current,
      [activeTab]: emptyCatalogFilters,
    }));
    setAppliedFiltersByTab((current) => ({
      ...current,
      [activeTab]: emptyCatalogFilters,
    }));
    resetActivePage();
  };
  const saveCurrentFilter = () => {
    const filterName = newFilterName.trim();
    if (!currentEmployee?.id || !filterName) return;
    const nextFilter: SavedFilter<CatalogFilters, CatalogTab> = {
      id: createSavedFilterId('catalog-filter'),
      employeeId: currentEmployee.id,
      name: filterName,
      icon: newFilterIcon,
      tab: activeTab,
      filters: normalizeCatalogFilters(appliedFilters),
      createdAt: new Date().toISOString(),
    };
    setSavedFilters((current) => [nextFilter, ...current]);
    setNewFilterName('');
    setNewFilterIcon(filterIconOptions[0]);
  };
  const applySavedFilter = (filterId: string) => {
    const savedFilter = savedFilters.find((item) => item.id === filterId);
    if (!savedFilter) return;
    const nextFilters = normalizeCatalogFilters(savedFilter.filters);
    setDraftFiltersByTab((current) => ({
      ...current,
      [savedFilter.tab]: nextFilters,
    }));
    setAppliedFiltersByTab((current) => ({
      ...current,
      [savedFilter.tab]: nextFilters,
    }));
    resetActivePage();
  };
  const removeSavedFilter = (filterId: string) => {
    setSavedFilters((current) =>
      current.filter((item) => item.id !== filterId),
    );
  };
  const filteredClientDevices = useMemo(() => {
    const uniqueByName = new Map<string, ClientDevice>();
    clientDevices.forEach((device) => {
      const key = device.name.trim().toLowerCase();
      if (!key || uniqueByName.has(key)) return;
      uniqueByName.set(key, device);
    });
    const uniqueDevices = Array.from(uniqueByName.values());
    const query = searchQuery.trim().toLowerCase();
    const filters = appliedFiltersByTab.products;
    const filterQuery = filters.query.trim().toLowerCase();
    return uniqueDevices.filter((device) => {
      const name = device.name.trim().toLowerCase();
      if (query && !name.includes(query)) return false;
      if (filterQuery && !name.includes(filterQuery)) return false;
      if (filters.status === 'active' && !device.isActive) return false;
      if (filters.status === 'inactive' && device.isActive) return false;
      if (
        !isDateInCatalogRange(
          device.createdAt,
          filters.dateFrom,
          filters.dateTo,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [appliedFiltersByTab.products, clientDevices, searchQuery]);
  const paginatedProducts = useMemo(() => {
    const start = (productsPage - 1) * productsPageSize;
    return filteredClientDevices.slice(start, start + productsPageSize);
  }, [filteredClientDevices, productsPage, productsPageSize]);
  const filteredCatalogProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filters = appliedFiltersByTab.catalogProducts;
    const filterQuery = filters.query.trim().toLowerCase();
    const noteQuery = filters.note.trim().toLowerCase();
    return catalogProducts.filter((product) => {
      const searchable = [product.name, product.note].join(' ').toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (filterQuery && !product.name.toLowerCase().includes(filterQuery)) {
        return false;
      }
      if (noteQuery && !product.note.toLowerCase().includes(noteQuery)) return false;
      if (filters.status === 'active' && !product.isActive) return false;
      if (filters.status === 'inactive' && product.isActive) return false;
      if (
        !isDateInCatalogRange(
          product.createdAt,
          filters.dateFrom,
          filters.dateTo,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [appliedFiltersByTab.catalogProducts, catalogProducts, searchQuery]);
  const paginatedCatalogProducts = useMemo(() => {
    const start = (catalogProductsPage - 1) * catalogProductsPageSize;
    return filteredCatalogProducts.slice(
      start,
      start + catalogProductsPageSize,
    );
  }, [
    catalogProductsPage,
    catalogProductsPageSize,
    filteredCatalogProducts,
  ]);
  const filteredServices = useMemo(() => {
    const filters = appliedFiltersByTab.services;
    const normalizedQuery = serviceSearchQuery.trim().toLowerCase();
    const filterQuery = filters.query.trim().toLowerCase();
    const noteQuery = filters.note.trim().toLowerCase();
    const priceFrom = parseCatalogNumberFilter(filters.priceFrom);
    const priceTo = parseCatalogNumberFilter(filters.priceTo);

    return services.filter((service) => {
      const searchable = [service.name, service.note].join(' ').toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (filterQuery && !service.name.toLowerCase().includes(filterQuery)) {
        return false;
      }
      if (noteQuery && !service.note.toLowerCase().includes(noteQuery)) return false;
      if (filters.status === 'active' && !service.isActive) return false;
      if (filters.status === 'inactive' && service.isActive) return false;
      if (priceFrom !== null && service.price < priceFrom) return false;
      if (priceTo !== null && service.price > priceTo) return false;
      if (
        !isDateInCatalogRange(
          service.createdAt,
          filters.dateFrom,
          filters.dateTo,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [appliedFiltersByTab.services, serviceSearchQuery, services]);
  const paginatedServices = useMemo(() => {
    const start = (servicesPage - 1) * servicesPageSize;
    return filteredServices.slice(start, start + servicesPageSize);
  }, [filteredServices, servicesPage, servicesPageSize]);
  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filters = appliedFiltersByTab.suppliers;
    const filterQuery = filters.query.trim().toLowerCase();
    const noteQuery = filters.note.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      const searchable = [supplier.name, supplier.phone, supplier.note]
        .join(' ')
        .toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (
        filterQuery &&
        ![supplier.name, supplier.phone]
          .join(' ')
          .toLowerCase()
          .includes(filterQuery)
      ) {
        return false;
      }
      if (noteQuery && !supplier.note.toLowerCase().includes(noteQuery)) return false;
      if (filters.status === 'active' && !supplier.isActive) return false;
      if (filters.status === 'inactive' && supplier.isActive) return false;
      if (
        !isDateInCatalogRange(
          supplier.createdAt,
          filters.dateFrom,
          filters.dateTo,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [appliedFiltersByTab.suppliers, searchQuery, suppliers]);
  const paginatedSuppliers = useMemo(() => {
    const start = (suppliersPage - 1) * suppliersPageSize;
    return filteredSuppliers.slice(start, start + suppliersPageSize);
  }, [filteredSuppliers, suppliersPage, suppliersPageSize]);
  const catalogNumbers = new Map(
    [...products, ...services]
      .sort((firstItem, secondItem) =>
        new Date(firstItem.createdAt).getTime() - new Date(secondItem.createdAt).getTime(),
      )
      .map((item, index) => [item.id, index + 1]),
  );

  const closeServiceForm = () => {
    onServiceCancelEdit();
    setIsServiceFormOpen(false);
  };

  const openServiceForm = () => {
    if (isServiceFormOpen) {
      closeServiceForm();
      return;
    }
    onServiceCancelEdit();
    setIsServiceFormOpen(true);
  };

  const editService = (service: ServiceCatalogItem) => {
    onServiceEdit(service);
    setSelectedService(service);
  };

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredClientDevices.length / productsPageSize),
    );
    if (productsPage > pageCount) {
      setProductsPage(pageCount);
    }
  }, [filteredClientDevices.length, productsPage, productsPageSize]);

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredCatalogProducts.length / catalogProductsPageSize),
    );
    if (catalogProductsPage > pageCount) {
      setCatalogProductsPage(pageCount);
    }
  }, [
    catalogProductsPage,
    catalogProductsPageSize,
    filteredCatalogProducts.length,
  ]);

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredServices.length / servicesPageSize),
    );
    if (servicesPage > pageCount) {
      setServicesPage(pageCount);
    }
  }, [filteredServices.length, servicesPage, servicesPageSize]);

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredSuppliers.length / suppliersPageSize),
    );
    if (suppliersPage > pageCount) {
      setSuppliersPage(pageCount);
    }
  }, [filteredSuppliers.length, suppliersPage, suppliersPageSize]);

  useEffect(() => {
    window.localStorage.setItem(catalogTabStorageKey, activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(
      catalogActiveFiltersStorageKey,
      JSON.stringify(appliedFiltersByTab),
    );
  }, [appliedFiltersByTab]);

  useEffect(() => {
    window.localStorage.setItem(
      catalogSavedFiltersStorageKey,
      JSON.stringify(savedFilters),
    );
  }, [savedFilters]);

  useEffect(() => {
    if (!selectedService) return;
    const updatedSelectedService = services.find((service) => service.id === selectedService.id);
    setSelectedService(updatedSelectedService ?? null);
  }, [services, selectedService]);

  return (
    <section className="panel catalog-table-panel">
      <div className="catalog-tabs" role="tablist" aria-label={t('catalog.tabsAriaLabel')}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              tab.key === activeTab
                ? 'catalog-tab catalog-tab-active'
                : 'catalog-tab'
            }
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="catalog-toolbar">
        {isProductsTab ? (
          <CompactPaginationPanel
            totalItems={filteredClientDevices.length}
            page={productsPage}
            pageSize={productsPageSize}
            onPageChange={setProductsPage}
          />
        ) : isSuppliersTab ? (
          <CompactPaginationPanel
            totalItems={filteredSuppliers.length}
            page={suppliersPage}
            pageSize={suppliersPageSize}
            onPageChange={setSuppliersPage}
          />
        ) : isCatalogProductsTab ? (
          <CompactPaginationPanel
            totalItems={filteredCatalogProducts.length}
            page={catalogProductsPage}
            pageSize={catalogProductsPageSize}
            onPageChange={setCatalogProductsPage}
          />
        ) : (
          <CompactPaginationPanel
            totalItems={filteredServices.length}
            page={servicesPage}
            pageSize={servicesPageSize}
            onPageChange={setServicesPage}
          />
        )}
        <button
          type="button"
          className="toolbar-filter-button toolbar-filter-toggle-button"
          aria-expanded={isFilterPanelOpen}
          onClick={() => setIsFilterPanelOpen((current) => !current)}
        >
          {t('catalog.toolbar.filter')}
          {activeFiltersCount > 0 ? (
            <span className="toolbar-filter-count">{activeFiltersCount}</span>
          ) : null}
        </button>
        <div className="orders-search-group orders-search-group-clearable catalog-search-group">
          <input
            value={isProductsTab || isCatalogProductsTab || isSuppliersTab ? currentSearchValue : currentServiceSearchValue}
            placeholder={
              isProductsTab
                ? t('catalog.toolbar.searchDeviceName')
                : isCatalogProductsTab
                  ? t('catalog.toolbar.searchProductName')
                : isSuppliersTab
                  ? t('catalog.toolbar.searchSupplierNameOrPhone')
                  : t('catalog.toolbar.searchServiceNameOrNote')
            }
            onChange={(event) =>
              isProductsTab || isCatalogProductsTab || isSuppliersTab
                ? (onSearchChange(event.target.value),
                  isSuppliersTab
                    ? setSuppliersPage(1)
                    : isCatalogProductsTab
                      ? setCatalogProductsPage(1)
                      : setProductsPage(1))
                : (onServiceSearchChange(event.target.value), setServicesPage(1))
            }
          />
          {(isProductsTab || isCatalogProductsTab || isSuppliersTab ? currentSearchValue : currentServiceSearchValue) ? (
            <span
              role='button'
              tabIndex={0}
              className='orders-search-clear'
              aria-label={t('catalog.toolbar.clearSearchAriaLabel')}
              onClick={() =>
                isProductsTab || isCatalogProductsTab || isSuppliersTab
                  ? (onSearchChange(''),
                    isSuppliersTab
                      ? setSuppliersPage(1)
                      : isCatalogProductsTab
                        ? setCatalogProductsPage(1)
                        : setProductsPage(1))
                  : (onServiceSearchChange(''), setServicesPage(1))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (isProductsTab || isCatalogProductsTab || isSuppliersTab) {
                    onSearchChange('');
                    if (isSuppliersTab) {
                      setSuppliersPage(1);
                    } else if (isCatalogProductsTab) {
                      setCatalogProductsPage(1);
                    } else {
                      setProductsPage(1);
                    }
                  } else {
                    onServiceSearchChange('');
                    setServicesPage(1);
                  }
                }
              }}
            >
              x
            </span>
          ) : null}
        </div>
        <div className="catalog-toolbar-actions">
          {isProductsTab ? (
            <button type="button" className="orders-create-button" onClick={() => setIsCreateDeviceModalOpen(true)}>
              {t('catalog.toolbar.createDevice')}
            </button>
          ) : isSuppliersTab ? (
            <button type="button" className="orders-create-button" onClick={() => setIsCreateSupplierModalOpen(true)}>
              {t('catalog.toolbar.createSupplier')}
            </button>
          ) : isCatalogProductsTab ? (
            <button
              type="button"
              className="orders-create-button"
              onClick={() => setIsCreateCatalogProductModalOpen(true)}
            >
              {t('catalog.toolbar.createProduct')}
            </button>
          ) : (
            <button type="button" className="orders-create-button" onClick={openServiceForm}>
              {t('catalog.toolbar.createService')}
            </button>
          )}
        </div>
      </div>

      <CatalogFilterPanel
        activeTab={activeTab}
        canSave={Boolean(currentEmployee?.id)}
        draftFilters={draftFilters}
        isOpen={isFilterPanelOpen}
        newFilterIcon={newFilterIcon}
        newFilterName={newFilterName}
        savedFilters={visibleSavedFilters.map((item) => ({
          id: item.id,
          name: item.name,
          icon: item.icon,
        }))}
        onApply={applyFilters}
        onApplySaved={applySavedFilter}
        onClear={clearFilters}
        onDeleteSaved={removeSavedFilter}
        onIconChange={setNewFilterIcon}
        onNameChange={setNewFilterName}
        onSave={saveCurrentFilter}
        onUpdate={updateDraftFilter}
      />

      {!isProductsTab && !isSuppliersTab && !isCatalogProductsTab && isServiceFormOpen ? (
        <div className="catalog-inline-form">
          <ServiceCatalogForm
            form={serviceForm}
            isSaving={isServiceSaving}
            isEditing={isServiceEditing}
            onChange={onServiceChange}
            onSubmit={onServiceSubmit}
            onCancelEdit={closeServiceForm}
          />
        </div>
      ) : null}

      {isProductsTab ? (
        <>
          <ProductsTable
            products={paginatedProducts}
            isLoading={isLoading}
            searchQuery={searchQuery}
            rowStartIndex={(productsPage - 1) * productsPageSize}
            onSelectDevice={setSelectedClientDevice}
          />
          <PaginationPanel
            totalItems={filteredClientDevices.length}
            page={productsPage}
            pageSize={productsPageSize}
            onPageChange={setProductsPage}
            onPageSizeChange={(nextPageSize) => {
              setProductsPageSize(nextPageSize);
              setProductsPage(1);
            }}
          />
        </>
      ) : isCatalogProductsTab ? (
        <>
          <CatalogProductsTable
            products={paginatedCatalogProducts}
            isLoading={isCatalogProductsLoading}
            searchQuery={searchQuery}
            rowStartIndex={
              (catalogProductsPage - 1) * catalogProductsPageSize
            }
            onSelectProduct={setSelectedCatalogProduct}
          />
          <PaginationPanel
            totalItems={filteredCatalogProducts.length}
            page={catalogProductsPage}
            pageSize={catalogProductsPageSize}
            onPageChange={setCatalogProductsPage}
            onPageSizeChange={(nextPageSize) => {
              setCatalogProductsPageSize(nextPageSize);
              setCatalogProductsPage(1);
            }}
          />
        </>
      ) : isSuppliersTab ? (
        <>
          <SuppliersTable suppliers={paginatedSuppliers} searchQuery={searchQuery} onSelectSupplier={setSelectedSupplier} />
          <PaginationPanel
            totalItems={filteredSuppliers.length}
            page={suppliersPage}
            pageSize={suppliersPageSize}
            onPageChange={setSuppliersPage}
            onPageSizeChange={(nextPageSize) => {
              setSuppliersPageSize(nextPageSize);
              setSuppliersPage(1);
            }}
          />
        </>
      ) : (
        <>
          <ServicesTable
            services={paginatedServices}
            isLoading={isServicesLoading}
            searchQuery={serviceSearchQuery}
            onEdit={editService}
            rowStartIndex={(servicesPage - 1) * servicesPageSize}
          />
          <PaginationPanel
            totalItems={filteredServices.length}
            page={servicesPage}
            pageSize={servicesPageSize}
            onPageChange={setServicesPage}
            onPageSizeChange={(nextPageSize) => {
              setServicesPageSize(nextPageSize);
              setServicesPage(1);
            }}
          />
        </>
      )}

      {selectedService && !isSuppliersTab ? (
        <CatalogServiceModal
          service={selectedService}
          form={serviceForm}
          isSaving={isServiceSaving}
          isEditing={isServiceEditing}
          onChange={onServiceChange}
          onSubmit={onServiceSubmit}
          onClose={() => {
            onServiceCancelEdit();
            setSelectedService(null);
          }}
          onArchive={() => {
            onServiceArchive(selectedService);
            setSelectedService(null);
          }}
          onActivate={() => onServiceActivate(selectedService)}
          catalogNumber={catalogNumbers.get(selectedService.id) ?? 0}
        />
      ) : null}

      {selectedSupplier ? (
        <SupplierModal
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          onSave={async (payload) => {
            const ok = await onUpdateSupplier(selectedSupplier.id, payload);
            if (ok) setSelectedSupplier(null);
          }}
          onCreate={onCreateSupplier}
        />
      ) : null}

      {selectedClientDevice ? (
        <ClientDeviceModal
          device={selectedClientDevice}
          onClose={() => setSelectedClientDevice(null)}
          onSave={async (payload) => {
            const ok = await onUpdateClientDevice(selectedClientDevice.id, payload);
            if (ok) setSelectedClientDevice(null);
          }}
          onRemove={async () => {
            if (
              !window.confirm(
                i18n.t('catalog.modals.confirmRemoveDevice', {
                  name: selectedClientDevice.name,
                }),
              )
            ) {
              return;
            }
            const ok = await onDeleteClientDevice(selectedClientDevice.id);
            if (ok) setSelectedClientDevice(null);
          }}
        />
      ) : null}

      {selectedCatalogProduct ? (
        <CatalogSuggestionProductModal
          product={selectedCatalogProduct}
          onClose={() => setSelectedCatalogProduct(null)}
          onSave={async (payload) => {
            const ok = await onUpdateCatalogProduct(selectedCatalogProduct.id, payload);
            if (ok) setSelectedCatalogProduct(null);
          }}
          onRemove={async () => {
            if (
              !window.confirm(
                i18n.t('catalog.modals.confirmRemoveProduct', {
                  name: selectedCatalogProduct.name,
                }),
              )
            ) {
              return;
            }
            const ok = await onDeleteCatalogProduct(selectedCatalogProduct.id);
            if (ok) setSelectedCatalogProduct(null);
          }}
        />
      ) : null}

      {isCreateDeviceModalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCreateDeviceModalOpen(false); }}>
          <section className="catalog-edit-modal" role="dialog" aria-modal="true">
            <header className="catalog-edit-header">
              <div className="catalog-edit-title"><h2>{t('catalog.modals.clientDevice')}</h2></div>
              <button type="button" className="create-order-close" onClick={() => setIsCreateDeviceModalOpen(false)} aria-label={t('catalog.modals.close')}>&times;</button>
            </header>
            <div className="catalog-edit-body">
              <label className="field"><span>{t('catalog.modals.deviceName')}</span><input value={createDeviceForm.name} onChange={(e) => setCreateDeviceForm((c) => ({ ...c, name: e.target.value }))} /></label>
              <label className="field field-wide"><span>{t('catalog.modals.note')}</span><textarea rows={3} value={createDeviceForm.note} onChange={(e) => setCreateDeviceForm((c) => ({ ...c, note: e.target.value }))} /></label>
            </div>
            <footer className="catalog-edit-footer">
              <button type="button" className="secondary-button" onClick={() => setIsCreateDeviceModalOpen(false)}>
                {t('catalog.modals.cancel')}
              </button>
              <button type="button" className="primary-button" disabled={!createDeviceForm.name.trim()} onClick={async () => {
                const ok = await onCreateClientDevice({
                  clientId: '',
                  clientName: '',
                  clientPhone: '',
                  ...createDeviceForm,
                  serialNumber: '',
                  source: 'clientCard',
                  isActive: true,
                });
                if (ok) {
                  setIsCreateDeviceModalOpen(false);
                  setCreateDeviceForm({ name: '', note: '' });
                }
              }}>{t('catalog.modals.save')}</button>
            </footer>
          </section>
        </div>
      ) : null}

      {isCreateSupplierModalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCreateSupplierModalOpen(false); }}>
          <section className="catalog-edit-modal" role="dialog" aria-modal="true">
            <header className="catalog-edit-header">
              <div className="catalog-edit-title"><h2>{t('catalog.modals.createSupplier')}</h2></div>
              <button type="button" className="create-order-close" onClick={() => setIsCreateSupplierModalOpen(false)} aria-label={t('catalog.modals.close')}>&times;</button>
            </header>
            <div className="catalog-edit-body">
              <label className="field"><span>{t('catalog.modals.name')}</span><input value={createSupplierForm.name} onChange={(e) => setCreateSupplierForm((c) => ({ ...c, name: e.target.value }))} /></label>
              <label className="field"><span>{t('catalog.modals.phone')}</span><input value={createSupplierForm.phone} onChange={(e) => setCreateSupplierForm((c) => ({ ...c, phone: e.target.value }))} /></label>
              <label className="field field-wide"><span>{t('catalog.modals.note')}</span><textarea rows={3} value={createSupplierForm.note} onChange={(e) => setCreateSupplierForm((c) => ({ ...c, note: e.target.value }))} /></label>
            </div>
            <footer className="catalog-edit-footer">
              <button type="button" className="primary-button" disabled={!createSupplierForm.name.trim() || !createSupplierForm.phone.trim()} onClick={async () => {
                const ok = await onCreateSupplier({ ...createSupplierForm, isActive: true });
                if (ok) {
                  setIsCreateSupplierModalOpen(false);
                  setCreateSupplierForm({ name: '', phone: '+380', note: '' });
                }
              }}>{t('catalog.modals.create')}</button>
            </footer>
          </section>
        </div>
      ) : null}

      {isCreateCatalogProductModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsCreateCatalogProductModalOpen(false);
          }}
        >
          <section className="catalog-edit-modal" role="dialog" aria-modal="true">
            <header className="catalog-edit-header">
              <div className="catalog-edit-title"><h2>{t('catalog.modals.product')}</h2></div>
              <button
                type="button"
                className="create-order-close"
                onClick={() => setIsCreateCatalogProductModalOpen(false)}
                aria-label={t('catalog.modals.close')}
              >
                &times;
              </button>
            </header>
            <div className="catalog-edit-body">
              <label className="field">
                <span>{t('catalog.modals.productName')}</span>
                <input
                  value={createCatalogProductForm.name}
                  onChange={(event) =>
                    setCreateCatalogProductForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field field-wide">
                <span>{t('catalog.modals.note')}</span>
                <textarea
                  rows={3}
                  value={createCatalogProductForm.note}
                  onChange={(event) =>
                    setCreateCatalogProductForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <footer className="catalog-edit-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsCreateCatalogProductModalOpen(false)}
                disabled={isCreateCatalogProductSaving}
              >
                {t('catalog.modals.cancel')}
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={
                  isCreateCatalogProductSaving ||
                  createCatalogProductForm.name.trim().length < 2 ||
                  catalogProducts.some(
                    (item) =>
                      item.name.trim().toLowerCase() ===
                      createCatalogProductForm.name.trim().toLowerCase(),
                  )
                }
                onClick={async () => {
                  setIsCreateCatalogProductSaving(true);
                  const ok = await onCreateCatalogProduct({
                    name: createCatalogProductForm.name.trim(),
                    note: createCatalogProductForm.note.trim(),
                    isActive: true,
                  });
                  if (ok) {
                    setCreateCatalogProductForm({ name: '', note: '' });
                    setIsCreateCatalogProductModalOpen(false);
                  }
                  setIsCreateCatalogProductSaving(false);
                }}
              >
                {isCreateCatalogProductSaving
                  ? t('catalog.modals.saving')
                  : t('catalog.modals.save')}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
};

type CatalogFilterPanelProps = {
  activeTab: CatalogTab;
  canSave: boolean;
  draftFilters: CatalogFilters;
  isOpen: boolean;
  newFilterIcon: string;
  newFilterName: string;
  savedFilters: Array<{ id: string; name: string; icon: string }>;
  onApply: () => void;
  onApplySaved: (id: string) => void;
  onClear: () => void;
  onDeleteSaved: (id: string) => void;
  onIconChange: (icon: string) => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onUpdate: <K extends keyof CatalogFilters>(
    field: K,
    value: CatalogFilters[K],
  ) => void;
};

const CatalogFilterPanel = ({
  activeTab,
  canSave,
  draftFilters,
  isOpen,
  newFilterIcon,
  newFilterName,
  savedFilters,
  onApply,
  onApplySaved,
  onClear,
  onDeleteSaved,
  onIconChange,
  onNameChange,
  onSave,
  onUpdate,
}: CatalogFilterPanelProps) => {
  const { t } = useTranslation();
  const isServicesTab = activeTab === 'services';
  const queryLabel =
    activeTab === 'products'
      ? t('catalog.filters.deviceName')
      : activeTab === 'catalogProducts'
        ? t('catalog.filters.productName')
        : activeTab === 'suppliers'
          ? t('catalog.filters.supplierNameOrPhone')
          : t('catalog.filters.serviceName');

  return (
    <section
      className={
        isOpen
          ? 'orders-filter-panel orders-filter-panel-open'
          : 'orders-filter-panel'
      }
    >
      <SavedFiltersPanel
        canSave={canSave}
        items={savedFilters}
        newFilterIcon={newFilterIcon}
        newFilterName={newFilterName}
        saveDisabled={!newFilterName.trim()}
        saveTitle={
          canSave
            ? t('orders.filters.saveFilter')
            : t('orders.filters.saveFilterDenied')
        }
        onApply={onApplySaved}
        onDelete={onDeleteSaved}
        onIconChange={onIconChange}
        onNameChange={onNameChange}
        onSave={onSave}
      />
      <div className='orders-filter-grid'>
        <label className='orders-filter-field'>
          <span>{queryLabel}</span>
          <input
            type='text'
            value={draftFilters.query}
            onChange={(event) => onUpdate('query', event.target.value)}
            placeholder={queryLabel}
          />
        </label>
        {activeTab === 'catalogProducts' ||
        activeTab === 'services' ||
        activeTab === 'suppliers' ? (
          <label className='orders-filter-field'>
            <span>{t('catalog.filters.note')}</span>
            <input
              type='text'
              value={draftFilters.note}
              onChange={(event) => onUpdate('note', event.target.value)}
              placeholder={t('catalog.filters.note')}
            />
          </label>
        ) : null}
        <label className='orders-filter-field'>
          <span>{t('catalog.filters.status')}</span>
          <select
            value={draftFilters.status}
            onChange={(event) =>
              onUpdate(
                'status',
                event.target.value as CatalogFilters['status'],
              )
            }
          >
            <option value='all'>{t('catalog.filters.all')}</option>
            <option value='active'>{t('catalog.filters.active')}</option>
            <option value='inactive'>{t('catalog.filters.inactive')}</option>
          </select>
        </label>
        {isServicesTab ? (
          <>
            <label className='orders-filter-field'>
              <span>{t('catalog.filters.priceFrom')}</span>
              <input
                type='number'
                min='0'
                value={draftFilters.priceFrom}
                onChange={(event) =>
                  onUpdate('priceFrom', event.target.value)
                }
                placeholder='0'
              />
            </label>
            <label className='orders-filter-field'>
              <span>{t('catalog.filters.priceTo')}</span>
              <input
                type='number'
                min='0'
                value={draftFilters.priceTo}
                onChange={(event) => onUpdate('priceTo', event.target.value)}
                placeholder='0'
              />
            </label>
          </>
        ) : null}
        <label className='orders-filter-field'>
          <span>{t('catalog.filters.dateFrom')}</span>
          <input
            type='date'
            value={draftFilters.dateFrom}
            onChange={(event) => onUpdate('dateFrom', event.target.value)}
          />
        </label>
        <label className='orders-filter-field'>
          <span>{t('catalog.filters.dateTo')}</span>
          <input
            type='date'
            value={draftFilters.dateTo}
            onChange={(event) => onUpdate('dateTo', event.target.value)}
          />
        </label>
      </div>
      <div className='orders-filter-actions'>
        <button
          type='button'
          className='toolbar-filter-button orders-filter-apply'
          onClick={onApply}
        >
          {t('catalog.filters.apply')}
        </button>
        <button
          type='button'
          className='toolbar-filter-button'
          onClick={onClear}
        >
          {t('catalog.filters.clearFilter')}
        </button>
      </div>
    </section>
  );
};


