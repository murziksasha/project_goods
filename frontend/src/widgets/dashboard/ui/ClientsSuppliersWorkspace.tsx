import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatDateTime } from '../../../shared/lib/format';
import {
  CompactPaginationPanel,
  PaginationPanel,
} from '../../../shared/ui/PaginationPanel';
import type { Sale } from '../../../entities/sale/model/types';
import type {
  Client,
  ClientFormValues,
  ClientHistory,
} from '../../../entities/client/model/types';
import type {
  Supplier,
  SupplierFormValues,
} from '../../../entities/supplier/model/types';
import type { Employee } from '../../../entities/employee/model/types';
import { ClientsWorkspace } from './ClientsWorkspace';
import { filterIconOptions } from './orders-workspace-shared';
import {
  clientsSuppliersSavedFiltersStorageKey,
  type ClientFilters,
} from '../model/clients-workspace';
import {
  createSavedFilterId,
  readSavedFilters,
  type SavedFilter,
} from '../model/saved-filters';
import { SavedFiltersPanel } from './SavedFiltersPanel';

type TabKey = 'clients' | 'suppliers';
type SupplierFormState = Required<SupplierFormValues>;
type SupplierSuggestionField = 'target' | 'source';
type SupplierStatusFilter = 'all' | 'active' | 'inactive';
type SupplierFilters = {
  query: string;
  supplierId: string;
  status: SupplierStatusFilter;
  dateFrom: string;
  dateTo: string;
  note: string;
};

const clientsSuppliersTabStorageKey = 'project-goods.clients-suppliers-tab';
const supplierFiltersStorageKey = 'project-goods.suppliers-active-filters';
const defaultSupplierForm: SupplierFormState = {
  name: '',
  phone: '+380',
  supplierOrder: '',
  note: '',
  isActive: true,
};
const clientsSuppliersTabs: Array<{ key: TabKey; label: string }> = [
  { key: 'clients', label: 'Clients' },
  { key: 'suppliers', label: 'Suppliers' },
];
const emptySupplierFilters: SupplierFilters = {
  query: '',
  supplierId: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  note: '',
};

const getStoredClientsSuppliersTab = (): TabKey => {
  try {
    const storedTab = window.localStorage.getItem(clientsSuppliersTabStorageKey);
    return storedTab === 'clients' || storedTab === 'suppliers'
      ? storedTab
      : 'clients';
  } catch {
    return 'clients';
  }
};

const normalizeSupplierFilters = (
  filters?: Partial<SupplierFilters>,
): SupplierFilters => ({
  ...emptySupplierFilters,
  ...filters,
  query: filters?.query?.trim() ?? '',
  supplierId: filters?.supplierId?.trim() ?? '',
  status:
    filters?.status === 'active' || filters?.status === 'inactive'
      ? filters.status
      : 'all',
  dateFrom: filters?.dateFrom ?? '',
  dateTo: filters?.dateTo ?? '',
  note: filters?.note?.trim() ?? '',
});

const readSupplierFilters = () => {
  try {
    return normalizeSupplierFilters(
      JSON.parse(
        window.localStorage.getItem(supplierFiltersStorageKey) ?? '{}',
      ) as Partial<SupplierFilters>,
    );
  } catch {
    return emptySupplierFilters;
  }
};

const isSupplierDateInRange = (
  createdAt: string,
  dateFrom: string,
  dateTo: string,
) => {
  const isoDate = createdAt.slice(0, 10);
  if (dateFrom && isoDate < dateFrom) return false;
  if (dateTo && isoDate > dateTo) return false;
  return true;
};

const getActiveSupplierFiltersCount = (filters: SupplierFilters) =>
  (filters.query ? 1 : 0) +
  (filters.supplierId ? 1 : 0) +
  (filters.status !== 'all' ? 1 : 0) +
  (filters.dateFrom ? 1 : 0) +
  (filters.dateTo ? 1 : 0) +
  (filters.note ? 1 : 0);

const toSupplierForm = (supplier?: Supplier): SupplierFormState => ({
  name: supplier?.name ?? defaultSupplierForm.name,
  phone: supplier?.phone ?? defaultSupplierForm.phone,
  supplierOrder: supplier?.supplierOrder ?? defaultSupplierForm.supplierOrder,
  note: supplier?.note ?? defaultSupplierForm.note,
  isActive: supplier?.isActive ?? defaultSupplierForm.isActive,
});

const toSupplierPayload = (form: SupplierFormState): SupplierFormValues => ({
  name: form.name.trim(),
  phone: form.phone.trim(),
  supplierOrder: form.supplierOrder.trim(),
  note: form.note.trim(),
  isActive: form.isActive,
});

const getSearchText = (supplier: Supplier) =>
  [
    supplier.name,
    supplier.phone,
    supplier.note,
    supplier.supplierOrder,
  ]
    .join(' ')
    .toLowerCase();

const getSupplierLabel = (supplier: Supplier) =>
  `${supplier.name} (${supplier.phone})`;

const getSupplierMergeOptions = (
  suppliers: Supplier[],
  query: string,
) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return suppliers
    .filter((supplier) =>
      `${supplier.name} ${supplier.phone}`.toLowerCase().includes(normalized),
    )
    .slice(0, 6);
};

const findDuplicateSupplier = (
  suppliers: Supplier[],
  form: SupplierFormState,
  editingSupplierId: string | null,
) => {
  const name = form.name.trim().toLowerCase();
  const phoneDigits = form.phone.replace(/\D/g, '');

  return suppliers.find((supplier) => {
    if (editingSupplierId && supplier.id === editingSupplierId) {
      return false;
    }

    const sameName =
      name.length > 0 && supplier.name.trim().toLowerCase() === name;
    const samePhone =
      phoneDigits.length > 0 &&
      supplier.phone.replace(/\D/g, '') === phoneDigits;

    return sameName || samePhone;
  });
};

type Props = {
  currentEmployee: Employee | null;
  clients: Client[];
  sales: Sale[];
  suppliers: Supplier[];
  selectedClientId: string | null;
  history: ClientHistory | null;
  isClientsLoading: boolean;
  isHistoryLoading: boolean;
  isSaving: boolean;
  isClientImporting: boolean;
  isClientExporting: boolean;
  onSelectClient: (clientId: string | null) => void;
  onDeleteClient: (client: Client) => Promise<void>;
  onCreateClient: (payload: ClientFormValues) => Promise<boolean>;
  onImportClients: (file: File) => Promise<boolean>;
  onExportClients: () => Promise<void>;
  onMergeClients: (
    targetClientId: string,
    sourceClientId: string,
  ) => Promise<boolean>;
  onMergeSuppliers: (
    targetSupplierId: string,
    sourceSupplierId: string,
  ) => Promise<boolean>;
  onUpdateClient: (
    clientId: string,
    payload: ClientFormValues,
  ) => Promise<boolean>;
  onOpenSaleCard: (sale: Sale) => void;
  openClientCardRequestId?: string | null;
  onOpenClientCardHandled?: () => void;
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onUpdateSupplier: (
    supplierId: string,
    payload: SupplierFormValues,
  ) => Promise<boolean>;
};

export const ClientsSuppliersWorkspace = ({
  currentEmployee,
  clients,
  sales,
  suppliers,
  selectedClientId,
  history,
  isClientsLoading,
  isHistoryLoading,
  isSaving,
  isClientImporting,
  isClientExporting,
  onSelectClient,
  onDeleteClient,
  onCreateClient,
  onImportClients,
  onExportClients,
  onMergeClients,
  onUpdateClient,
  onOpenSaleCard,
  openClientCardRequestId,
  onOpenClientCardHandled,
  onCreateSupplier,
  onMergeSuppliers,
  onUpdateSupplier,
}: Props) => {
  const [activeTab, setActiveTab] = useState<TabKey>(
    getStoredClientsSuppliersTab,
  );
  const [isSupplierFilterOpen, setIsSupplierFilterOpen] = useState(false);
  const [draftSupplierFilters, setDraftSupplierFilters] =
    useState<SupplierFilters>(readSupplierFilters);
  const [appliedSupplierFilters, setAppliedSupplierFilters] =
    useState<SupplierFilters>(readSupplierFilters);
  const [savedFilters, setSavedFilters] = useState<
    Array<SavedFilter<ClientFilters | SupplierFilters, TabKey>>
  >(() =>
    readSavedFilters<ClientFilters | SupplierFilters, TabKey>(
      clientsSuppliersSavedFiltersStorageKey,
      ['clients', 'suppliers'],
    ),
  );
  const [newSupplierFilterName, setNewSupplierFilterName] = useState('');
  const [newSupplierFilterIcon, setNewSupplierFilterIcon] = useState(
    filterIconOptions[0],
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(
    null,
  );
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [suppliersPage, setSuppliersPage] = useState(1);
  const [suppliersPageSize, setSuppliersPageSize] = useState(30);
  const [mergeTargetQuery, setMergeTargetQuery] = useState('');
  const [mergeSourceQuery, setMergeSourceQuery] = useState('');
  const [showMergeTargetSuggestions, setShowMergeTargetSuggestions] =
    useState(false);
  const [showMergeSourceSuggestions, setShowMergeSourceSuggestions] =
    useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [form, setForm] = useState<SupplierFormState>(defaultSupplierForm);

  const filteredSuppliers = useMemo(() => {
    const filters = appliedSupplierFilters;
    const normalized = filters.query.trim().toLowerCase();
    const supplierId = filters.supplierId.trim().toLowerCase();
    const note = filters.note.trim().toLowerCase();
    const sortedSuppliers = [...suppliers].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    return sortedSuppliers.filter((supplier) => {
      if (normalized && !getSearchText(supplier).includes(normalized)) {
        return false;
      }
      if (supplierId && !supplier.id.toLowerCase().includes(supplierId)) {
        return false;
      }
      if (note && !supplier.note.toLowerCase().includes(note)) return false;
      if (filters.status === 'active' && !supplier.isActive) return false;
      if (filters.status === 'inactive' && supplier.isActive) return false;
      if (
        !isSupplierDateInRange(
          supplier.createdAt,
          filters.dateFrom,
          filters.dateTo,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [appliedSupplierFilters, suppliers]);
  const paginatedSuppliers = useMemo(() => {
    const start = (suppliersPage - 1) * suppliersPageSize;
    return filteredSuppliers.slice(start, start + suppliersPageSize);
  }, [filteredSuppliers, suppliersPage, suppliersPageSize]);

  const duplicateSupplier = useMemo(
    () => findDuplicateSupplier(suppliers, form, editingSupplierId),
    [editingSupplierId, form, suppliers],
  );

  const mergeTargetOptions = useMemo(
    () => getSupplierMergeOptions(suppliers, mergeTargetQuery),
    [mergeTargetQuery, suppliers],
  );
  const mergeSourceOptions = useMemo(
    () => getSupplierMergeOptions(suppliers, mergeSourceQuery),
    [mergeSourceQuery, suppliers],
  );
  const visibleSupplierSavedFilters = useMemo(
    () =>
      currentEmployee?.id
        ? savedFilters
            .filter(
              (item) =>
                item.employeeId === currentEmployee.id &&
                item.tab === 'suppliers',
            )
            .sort(
              (first, second) =>
                new Date(second.createdAt).getTime() -
                new Date(first.createdAt).getTime(),
            )
        : [],
    [currentEmployee?.id, savedFilters],
  );
  const activeSupplierFiltersCount = getActiveSupplierFiltersCount(
    appliedSupplierFilters,
  );

  const openCreateModal = () => {
    setEditingSupplierId(null);
    setForm(defaultSupplierForm);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setForm(toSupplierForm(supplier));
    setIsCreateModalOpen(true);
  };

  const resetMergeModal = () => {
    setIsMergeModalOpen(false);
    setMergeTargetQuery('');
    setMergeSourceQuery('');
    setMergeTargetId('');
    setMergeSourceId('');
    setShowMergeTargetSuggestions(false);
    setShowMergeSourceSuggestions(false);
  };

  const handleSaveSupplier = async () => {
    const payload = toSupplierPayload(form);

    if (!payload.name || !payload.phone) return;

    const isSuccess = editingSupplierId
      ? await onUpdateSupplier(editingSupplierId, payload)
      : await onCreateSupplier(payload);

    if (!isSuccess) return;
    setIsCreateModalOpen(false);
  };

  const handleMergeSuppliers = async () => {
    if (!mergeTargetId || !mergeSourceId || mergeTargetId === mergeSourceId) {
      return;
    }

    const isSuccess = await onMergeSuppliers(mergeTargetId, mergeSourceId);
    if (!isSuccess) return;

    resetMergeModal();
  };

  const handleMergeQueryChange = (
    field: SupplierSuggestionField,
    value: string,
  ) => {
    if (field === 'target') {
      setMergeTargetQuery(value);
      setMergeTargetId('');
      setShowMergeTargetSuggestions(true);
      return;
    }

    setMergeSourceQuery(value);
    setMergeSourceId('');
    setShowMergeSourceSuggestions(true);
  };

  const handleMergeSupplierSelect = (
    field: SupplierSuggestionField,
    supplier: Supplier,
  ) => {
    if (field === 'target') {
      setMergeTargetId(supplier.id);
      setMergeTargetQuery(getSupplierLabel(supplier));
      setShowMergeTargetSuggestions(false);
      return;
    }

    setMergeSourceId(supplier.id);
    setMergeSourceQuery(getSupplierLabel(supplier));
    setShowMergeSourceSuggestions(false);
  };

  const applySupplierFilters = () => {
    const nextFilters = normalizeSupplierFilters(draftSupplierFilters);
    setDraftSupplierFilters(nextFilters);
    setAppliedSupplierFilters(nextFilters);
    setSuppliersPage(1);
  };

  const clearSupplierFilters = () => {
    setDraftSupplierFilters(emptySupplierFilters);
    setAppliedSupplierFilters(emptySupplierFilters);
    setSuppliersPage(1);
  };

  const updateSupplierQuery = (value: string) => {
    const nextQuery = value.trim();
    setDraftSupplierFilters((current) => ({
      ...current,
      query: nextQuery,
    }));
    setAppliedSupplierFilters((current) => ({
      ...current,
      query: nextQuery,
    }));
    setSuppliersPage(1);
  };

  const saveSupplierFilter = () => {
    const filterName = newSupplierFilterName.trim();
    if (!currentEmployee?.id || !filterName) return;
    const latestSavedFilters =
      readSavedFilters<ClientFilters | SupplierFilters, TabKey>(
        clientsSuppliersSavedFiltersStorageKey,
        ['clients', 'suppliers'],
      );
    const nextFilter: SavedFilter<ClientFilters | SupplierFilters, TabKey> = {
      id: createSavedFilterId('supplier-filter'),
      employeeId: currentEmployee.id,
      name: filterName,
      icon: newSupplierFilterIcon,
      tab: 'suppliers',
      filters: normalizeSupplierFilters(appliedSupplierFilters),
      createdAt: new Date().toISOString(),
    };
    setSavedFilters([nextFilter, ...latestSavedFilters]);
    setNewSupplierFilterName('');
    setNewSupplierFilterIcon(filterIconOptions[0]);
  };

  const applySupplierSavedFilter = (filterId: string) => {
    const savedFilter = savedFilters.find((item) => item.id === filterId);
    if (!savedFilter || savedFilter.tab !== 'suppliers') return;
    const nextFilters = normalizeSupplierFilters(
      savedFilter.filters as SupplierFilters,
    );
    setDraftSupplierFilters(nextFilters);
    setAppliedSupplierFilters(nextFilters);
    setSuppliersPage(1);
  };

  const removeSupplierSavedFilter = (filterId: string) => {
    const latestSavedFilters =
      readSavedFilters<ClientFilters | SupplierFilters, TabKey>(
        clientsSuppliersSavedFiltersStorageKey,
        ['clients', 'suppliers'],
      );
    setSavedFilters(
      latestSavedFilters.filter((item) => item.id !== filterId),
    );
  };

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
    try {
      window.localStorage.setItem(clientsSuppliersTabStorageKey, activeTab);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(
      supplierFiltersStorageKey,
      JSON.stringify(appliedSupplierFilters),
    );
  }, [appliedSupplierFilters]);

  useEffect(() => {
    window.localStorage.setItem(
      clientsSuppliersSavedFiltersStorageKey,
      JSON.stringify(savedFilters),
    );
  }, [savedFilters]);

  return (
    <section className='panel clients-workspace'>
      <ClientsSuppliersTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'clients' ? (
        <ClientsWorkspace
          currentEmployee={currentEmployee}
          clients={clients}
          sales={sales}
          selectedClientId={selectedClientId}
          history={history}
          isClientsLoading={isClientsLoading}
          isHistoryLoading={isHistoryLoading}
          isSaving={isSaving}
          isClientImporting={isClientImporting}
          isClientExporting={isClientExporting}
          onSelectClient={onSelectClient}
          onDeleteClient={onDeleteClient}
          onCreateClient={onCreateClient}
          onImportClients={onImportClients}
          onExportClients={onExportClients}
          onMergeClients={onMergeClients}
          onUpdateClient={onUpdateClient}
          onOpenSaleCard={onOpenSaleCard}
          openClientCardRequestId={openClientCardRequestId}
          onOpenClientCardHandled={onOpenClientCardHandled}
        />
      ) : (
        <SuppliersWorkspace
          activeFiltersCount={activeSupplierFiltersCount}
          canSaveFilter={Boolean(currentEmployee?.id)}
          draftFilters={draftSupplierFilters}
          isFilterOpen={isSupplierFilterOpen}
          newFilterIcon={newSupplierFilterIcon}
          newFilterName={newSupplierFilterName}
          query={appliedSupplierFilters.query}
          savedFilters={visibleSupplierSavedFilters.map((item) => ({
            id: item.id,
            name: item.name,
            icon: item.icon,
          }))}
          suppliers={paginatedSuppliers}
          totalSuppliersCount={filteredSuppliers.length}
          page={suppliersPage}
          pageSize={suppliersPageSize}
          onPageChange={setSuppliersPage}
          onPageSizeChange={(nextPageSize) => {
            setSuppliersPageSize(nextPageSize);
            setSuppliersPage(1);
          }}
          onApplyFilters={applySupplierFilters}
          onApplySavedFilter={applySupplierSavedFilter}
          onClearFilters={clearSupplierFilters}
          onDeleteSavedFilter={removeSupplierSavedFilter}
          onFilterIconChange={setNewSupplierFilterIcon}
          onFilterNameChange={setNewSupplierFilterName}
          onQueryChange={updateSupplierQuery}
          onOpenCreateModal={openCreateModal}
          onOpenEditModal={openEditModal}
          onOpenMergeModal={() => setIsMergeModalOpen(true)}
          onSaveFilter={saveSupplierFilter}
          onToggleFilters={() =>
            setIsSupplierFilterOpen((current) => !current)
          }
          onUpdateFilters={setDraftSupplierFilters}
        />
      )}

      {isCreateModalOpen ? (
        <SupplierEditorModal
          duplicateSupplier={duplicateSupplier}
          editingSupplierId={editingSupplierId}
          form={form}
          isSaving={isSaving}
          onChange={setForm}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={() => void handleSaveSupplier()}
        />
      ) : null}

      {isMergeModalOpen ? (
        <SupplierMergeModal
          isSaving={isSaving}
          sourceId={mergeSourceId}
          sourceOptions={mergeSourceOptions}
          sourceQuery={mergeSourceQuery}
          targetId={mergeTargetId}
          targetOptions={mergeTargetOptions}
          targetQuery={mergeTargetQuery}
          showSourceSuggestions={showMergeSourceSuggestions}
          showTargetSuggestions={showMergeTargetSuggestions}
          onClose={resetMergeModal}
          onQueryChange={handleMergeQueryChange}
          onSelectSupplier={handleMergeSupplierSelect}
          onMerge={() => void handleMergeSuppliers()}
        />
      ) : null}
    </section>
  );
};

const ClientsSuppliersTabs = ({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}) => (
  <div className='orders-tabs' role='tablist' aria-label='Clients and suppliers'>
    {clientsSuppliersTabs.map((tab) => (
      <button
        key={tab.key}
        type='button'
        className={
          activeTab === tab.key
            ? 'orders-tab orders-tab-active'
            : 'orders-tab'
        }
        onClick={() => onChange(tab.key)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

const SuppliersWorkspace = ({
  activeFiltersCount,
  canSaveFilter,
  draftFilters,
  isFilterOpen,
  newFilterIcon,
  newFilterName,
  query,
  savedFilters,
  suppliers,
  totalSuppliersCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onApplyFilters,
  onApplySavedFilter,
  onClearFilters,
  onDeleteSavedFilter,
  onFilterIconChange,
  onFilterNameChange,
  onQueryChange,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenMergeModal,
  onSaveFilter,
  onToggleFilters,
  onUpdateFilters,
}: {
  activeFiltersCount: number;
  canSaveFilter: boolean;
  draftFilters: SupplierFilters;
  isFilterOpen: boolean;
  newFilterIcon: string;
  newFilterName: string;
  query: string;
  savedFilters: Array<{ id: string; name: string; icon: string }>;
  suppliers: Supplier[];
  totalSuppliersCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onApplyFilters: () => void;
  onApplySavedFilter: (id: string) => void;
  onClearFilters: () => void;
  onDeleteSavedFilter: (id: string) => void;
  onFilterIconChange: (icon: string) => void;
  onFilterNameChange: (name: string) => void;
  onQueryChange: (value: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (supplier: Supplier) => void;
  onOpenMergeModal: () => void;
  onSaveFilter: () => void;
  onToggleFilters: () => void;
  onUpdateFilters: (filters: SupplierFilters) => void;
}) => (
  <>
    <SuppliersToolbar
      activeFiltersCount={activeFiltersCount}
      isFilterOpen={isFilterOpen}
      query={query}
      totalSuppliersCount={totalSuppliersCount}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onQueryChange={onQueryChange}
      onOpenCreateModal={onOpenCreateModal}
      onOpenMergeModal={onOpenMergeModal}
      onToggleFilters={onToggleFilters}
    />
    <SuppliersFilterPanel
      canSaveFilter={canSaveFilter}
      draftFilters={draftFilters}
      isOpen={isFilterOpen}
      newFilterIcon={newFilterIcon}
      newFilterName={newFilterName}
      savedFilters={savedFilters}
      onApply={onApplyFilters}
      onApplySavedFilter={onApplySavedFilter}
      onChange={onUpdateFilters}
      onClear={onClearFilters}
      onDeleteSavedFilter={onDeleteSavedFilter}
      onFilterIconChange={onFilterIconChange}
      onFilterNameChange={onFilterNameChange}
      onSaveFilter={onSaveFilter}
    />
    <SuppliersTable suppliers={suppliers} onOpenEditModal={onOpenEditModal} />
    <PaginationPanel
      totalItems={totalSuppliersCount}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  </>
);

const SuppliersToolbar = ({
  activeFiltersCount,
  isFilterOpen,
  query,
  totalSuppliersCount,
  page,
  pageSize,
  onPageChange,
  onQueryChange,
  onOpenCreateModal,
  onOpenMergeModal,
  onToggleFilters,
}: {
  activeFiltersCount: number;
  isFilterOpen: boolean;
  query: string;
  totalSuppliersCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onOpenCreateModal: () => void;
  onOpenMergeModal: () => void;
  onToggleFilters: () => void;
}) => (
  <div className='orders-toolbar clients-toolbar'>
    <div className='orders-toolbar-left'>
      <CompactPaginationPanel
        totalItems={totalSuppliersCount}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
      <button
        type='button'
        className='toolbar-filter-button toolbar-filter-toggle-button'
        aria-expanded={isFilterOpen}
        onClick={onToggleFilters}
      >
        Filter
        {activeFiltersCount > 0 ? (
          <span className='toolbar-filter-count'>
            {activeFiltersCount}
          </span>
        ) : null}
      </button>
      <div className='orders-search-group orders-search-group-clearable clients-search-group'>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder='Search by name, phone or supplier order'
        />
        {query ? (
          <span
            role='button'
            tabIndex={0}
            className='orders-search-clear'
            aria-label='Clear search text'
            onClick={() => onQueryChange('')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onQueryChange('');
              }
            }}
          >
            x
          </span>
        ) : null}
      </div>
    </div>
    <div className='orders-toolbar-actions clients-toolbar-actions'>
      <button
        type='button'
        className='secondary-button'
        onClick={onOpenMergeModal}
      >
        Merge
      </button>
      <button
        type='button'
        className='primary-button'
        onClick={onOpenCreateModal}
      >
        Create supplier
      </button>
    </div>
  </div>
);

const SuppliersFilterPanel = ({
  canSaveFilter,
  draftFilters,
  isOpen,
  newFilterIcon,
  newFilterName,
  savedFilters,
  onApply,
  onApplySavedFilter,
  onChange,
  onClear,
  onDeleteSavedFilter,
  onFilterIconChange,
  onFilterNameChange,
  onSaveFilter,
}: {
  canSaveFilter: boolean;
  draftFilters: SupplierFilters;
  isOpen: boolean;
  newFilterIcon: string;
  newFilterName: string;
  savedFilters: Array<{ id: string; name: string; icon: string }>;
  onApply: () => void;
  onApplySavedFilter: (id: string) => void;
  onChange: (filters: SupplierFilters) => void;
  onClear: () => void;
  onDeleteSavedFilter: (id: string) => void;
  onFilterIconChange: (icon: string) => void;
  onFilterNameChange: (name: string) => void;
  onSaveFilter: () => void;
}) => {
  const updateFilter = <K extends keyof SupplierFilters>(
    field: K,
    value: SupplierFilters[K],
  ) => onChange({ ...draftFilters, [field]: value });

  return (
    <section
      className={
        isOpen
          ? 'orders-filter-panel orders-filter-panel-open'
          : 'orders-filter-panel'
      }
    >
      <SavedFiltersPanel
        canSave={canSaveFilter}
        items={savedFilters}
        newFilterIcon={newFilterIcon}
        newFilterName={newFilterName}
        saveDisabled={!newFilterName.trim()}
        saveTitle={
          canSaveFilter
            ? 'Save filter'
            : 'Employee profile is required to save filters.'
        }
        onApply={onApplySavedFilter}
        onDelete={onDeleteSavedFilter}
        onIconChange={onFilterIconChange}
        onNameChange={onFilterNameChange}
        onSave={onSaveFilter}
      />
      <div className='orders-filter-grid'>
        <label className='orders-filter-field'>
          <span>Name / phone / order</span>
          <input
            type='text'
            value={draftFilters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
            placeholder='Supplier name or phone'
          />
        </label>
        <label className='orders-filter-field'>
          <span>Supplier ID</span>
          <input
            type='text'
            value={draftFilters.supplierId}
            onChange={(event) =>
              updateFilter('supplierId', event.target.value)
            }
            placeholder='ID'
          />
        </label>
        <label className='orders-filter-field'>
          <span>Status</span>
          <select
            value={draftFilters.status}
            onChange={(event) =>
              updateFilter(
                'status',
                event.target.value as SupplierStatusFilter,
              )
            }
          >
            <option value='all'>All</option>
            <option value='active'>Active</option>
            <option value='inactive'>Inactive</option>
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>Date from</span>
          <input
            type='date'
            value={draftFilters.dateFrom}
            onChange={(event) => updateFilter('dateFrom', event.target.value)}
          />
        </label>
        <label className='orders-filter-field'>
          <span>Date to</span>
          <input
            type='date'
            value={draftFilters.dateTo}
            onChange={(event) => updateFilter('dateTo', event.target.value)}
          />
        </label>
        <label className='orders-filter-field'>
          <span>Note</span>
          <input
            type='text'
            value={draftFilters.note}
            onChange={(event) => updateFilter('note', event.target.value)}
            placeholder='Note'
          />
        </label>
      </div>
      <div className='orders-filter-actions'>
        <button
          type='button'
          className='toolbar-filter-button orders-filter-apply'
          onClick={onApply}
        >
          Apply
        </button>
        <button
          type='button'
          className='toolbar-filter-button'
          onClick={onClear}
        >
          Clear filter
        </button>
      </div>
    </section>
  );
};

const SuppliersTable = ({
  suppliers,
  onOpenEditModal,
}: {
  suppliers: Supplier[];
  onOpenEditModal: (supplier: Supplier) => void;
}) => (
  <div className='orders-table-wrap'>
    <table className='orders-table clients-table'>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Phone</th>
          <th>Supplier order</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {suppliers.map((supplier) => (
          <tr
            key={supplier.id}
            className='clients-table-row'
            onClick={() => onOpenEditModal(supplier)}
          >
            <td data-label='ID'>{supplier.id.slice(-6)}</td>
            <td data-label='Name'>{supplier.name}</td>
            <td data-label='Phone'>{supplier.phone}</td>
            <td data-label='Supplier order'>{supplier.supplierOrder || '-'}</td>
            <td data-label='Status'>{supplier.isActive ? 'active' : 'inactive'}</td>
            <td data-label='Created'>{formatDateTime(supplier.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {suppliers.length === 0 ? (
      <p className='empty-state'>No suppliers found.</p>
    ) : null}
  </div>
);

const SupplierEditorModal = ({
  duplicateSupplier,
  editingSupplierId,
  form,
  isSaving,
  onChange,
  onClose,
  onSave,
}: {
  duplicateSupplier?: Supplier;
  editingSupplierId: string | null;
  form: SupplierFormState;
  isSaving: boolean;
  onChange: (form: SupplierFormState) => void;
  onClose: () => void;
  onSave: () => void;
}) => {
  const isEditing = Boolean(editingSupplierId);
  const canSave =
    !isSaving &&
    !duplicateSupplier &&
    Boolean(form.name.trim()) &&
    Boolean(form.phone.trim());
  const updateForm = <K extends keyof SupplierFormState>(
    field: K,
    value: SupplierFormState[K],
  ) => onChange({ ...form, [field]: value });

  return (
    <ModalShell
      title={isEditing ? 'Edit supplier' : 'Create supplier'}
      onClose={onClose}
    >
      <div className='catalog-edit-body clients-modal-body'>
        <label className='field field-wide'>
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
          />
        </label>
        <label className='field field-wide'>
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(event) => updateForm('phone', event.target.value)}
          />
        </label>
        <label className='field field-wide'>
          <span>Supplier order</span>
          <input
            value={form.supplierOrder}
            onChange={(event) =>
              updateForm('supplierOrder', event.target.value)
            }
          />
        </label>
        <label className='field field-wide'>
          <span>Note</span>
          <textarea
            rows={4}
            value={form.note}
            onChange={(event) => updateForm('note', event.target.value)}
          />
        </label>
        <label className='field field-wide'>
          <span>Status</span>
          <select
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(event) =>
              updateForm('isActive', event.target.value === 'active')
            }
          >
            <option value='active'>active</option>
            <option value='inactive'>inactive</option>
          </select>
        </label>
        {duplicateSupplier ? (
          <p className='error-message'>
            Supplier with same phone or name already exists:{' '}
            {duplicateSupplier.name}
          </p>
        ) : null}
      </div>
      <footer className='catalog-edit-footer'>
        <button
          type='button'
          className='primary-button'
          disabled={!canSave}
          onClick={onSave}
        >
          {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Create'}
        </button>
      </footer>
    </ModalShell>
  );
};

const SupplierMergeModal = ({
  isSaving,
  sourceId,
  sourceOptions,
  sourceQuery,
  targetId,
  targetOptions,
  targetQuery,
  showSourceSuggestions,
  showTargetSuggestions,
  onClose,
  onQueryChange,
  onSelectSupplier,
  onMerge,
}: {
  isSaving: boolean;
  sourceId: string;
  sourceOptions: Supplier[];
  sourceQuery: string;
  targetId: string;
  targetOptions: Supplier[];
  targetQuery: string;
  showSourceSuggestions: boolean;
  showTargetSuggestions: boolean;
  onClose: () => void;
  onQueryChange: (field: SupplierSuggestionField, value: string) => void;
  onSelectSupplier: (
    field: SupplierSuggestionField,
    supplier: Supplier,
  ) => void;
  onMerge: () => void;
}) => {
  const canMerge =
    !isSaving && Boolean(targetId) && Boolean(sourceId) && targetId !== sourceId;

  return (
    <ModalShell title='Merge suppliers' onClose={onClose}>
      <div className='catalog-edit-body clients-modal-body'>
        <p className='muted-copy'>
          Select Supplier 1 and Supplier 2. Data from Supplier 2 will be merged
          into Supplier 1, then Supplier 2 will be removed.
        </p>
        <SupplierMergeField
          label='Supplier 1'
          options={targetOptions}
          query={targetQuery}
          showSuggestions={showTargetSuggestions}
          onQueryChange={(value) => onQueryChange('target', value)}
          onSelectSupplier={(supplier) => onSelectSupplier('target', supplier)}
        />
        <SupplierMergeField
          label='Supplier 2'
          options={sourceOptions}
          query={sourceQuery}
          showSuggestions={showSourceSuggestions}
          onQueryChange={(value) => onQueryChange('source', value)}
          onSelectSupplier={(supplier) => onSelectSupplier('source', supplier)}
        />
      </div>
      <footer className='catalog-edit-footer'>
        <button
          type='button'
          className='primary-button'
          disabled={!canMerge}
          onClick={onMerge}
        >
          {isSaving ? 'Merging...' : 'Merge suppliers'}
        </button>
      </footer>
    </ModalShell>
  );
};

const SupplierMergeField = ({
  label,
  options,
  query,
  showSuggestions,
  onQueryChange,
  onSelectSupplier,
}: {
  label: string;
  options: Supplier[];
  query: string;
  showSuggestions: boolean;
  onQueryChange: (value: string) => void;
  onSelectSupplier: (supplier: Supplier) => void;
}) => (
  <>
    <label className='field field-wide modal-suggestions-anchor'>
      <span>{label}</span>
      <input
        value={query}
        placeholder='Enter name or phone'
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </label>
    {showSuggestions && options.length > 0 ? (
      <SupplierSuggestions
        options={options}
        onSelectSupplier={onSelectSupplier}
      />
    ) : null}
  </>
);

const SupplierSuggestions = ({
  options,
  onSelectSupplier,
}: {
  options: Supplier[];
  onSelectSupplier: (supplier: Supplier) => void;
}) => (
  <div className='suggestions-panel'>
    {options.map((supplier) => (
      <button
        key={supplier.id}
        type='button'
        className='suggestion-item'
        onClick={() => onSelectSupplier(supplier)}
      >
        <strong>{supplier.name}</strong>
        <span>{supplier.phone}</span>
      </button>
    ))}
  </div>
);

const ModalShell = ({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) => (
  <div className='modal-backdrop' role='presentation' onClick={onClose}>
    <article
      className='catalog-edit-modal clients-modal'
      role='dialog'
      aria-modal='true'
      onClick={(event) => event.stopPropagation()}
    >
      <header className='catalog-edit-header'>
        <h2>{title}</h2>
        <button type='button' className='ghost-button' onClick={onClose}>
          x
        </button>
      </header>
      {children}
    </article>
  </div>
);
