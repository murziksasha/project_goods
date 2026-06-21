import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  getPrimarySupplierPhone,
  getSupplierPhones,
  mapSupplierFormToPayload,
  toSupplierForm,
  type SupplierFormState,
} from '../../../entities/supplier/model/forms';
import { hasDuplicatePhones } from '../../../shared/lib/phones';
import { isValidUkrainianPhone } from '../../../shared/lib/phoneFormatter';
import { PhonesField } from '../../../shared/ui/PhonesField';
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
  phones: ['+380'],
  supplierOrder: '',
  note: '',
  isActive: true,
};
const clientsSuppliersTabs: Array<{ key: TabKey; labelKey: string }> = [
  { key: 'clients', labelKey: 'clients.tabs.clients' },
  { key: 'suppliers', labelKey: 'clients.tabs.suppliers' },
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

const toSupplierPayload = (form: SupplierFormState): SupplierFormValues =>
  mapSupplierFormToPayload(form);

const getSearchText = (supplier: Supplier) =>
  [
    supplier.name,
    ...getSupplierPhones(supplier),
    supplier.note,
    supplier.supplierOrder,
  ]
    .join(' ')
    .toLowerCase();

const getSupplierLabel = (supplier: Supplier) =>
  `${supplier.name} (${getPrimarySupplierPhone(supplier)})`;

const getSupplierMergeOptions = (
  suppliers: Supplier[],
  query: string,
) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return suppliers
    .filter((supplier) =>
      `${supplier.name} ${getSupplierPhones(supplier).join(' ')}`
        .toLowerCase()
        .includes(normalized),
    )
    .slice(0, 6);
};

const normalizeSupplierPhoneDigits = (phone: string) => phone.replace(/\D/g, '');

const findDuplicateSupplier = (
  suppliers: Supplier[],
  form: SupplierFormState,
  editingSupplierId: string | null,
) => {
  const name = form.name.trim().toLowerCase();
  const formPhoneDigits = (form.phones?.length ? form.phones : [form.phone])
    .map((phone) => normalizeSupplierPhoneDigits(phone || ''))
    .filter((phone) => phone.length > 0);

  return suppliers.find((supplier) => {
    if (editingSupplierId && supplier.id === editingSupplierId) {
      return false;
    }

    const sameName =
      name.length > 0 && supplier.name.trim().toLowerCase() === name;
    const supplierPhoneDigits = getSupplierPhones(supplier).map((phone) =>
      normalizeSupplierPhoneDigits(phone),
    );
    const samePhone = formPhoneDigits.some((phoneDigits) =>
      supplierPhoneDigits.includes(phoneDigits),
    );

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
}) => {
  const { t } = useTranslation();

  return (
    <div
      className='orders-tabs'
      role='tablist'
      aria-label={t('clients.tabs.clientsAndSuppliers')}
    >
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
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
};

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
}) => {
  const { t } = useTranslation();

  return (
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
          {t('clients.suppliers.toolbar.filter')}
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
            placeholder={t('clients.suppliers.toolbar.searchPlaceholder')}
          />
          {query ? (
            <span
              role='button'
              tabIndex={0}
              className='orders-search-clear'
              aria-label={t('clients.suppliers.toolbar.clearSearchAriaLabel')}
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
          {t('clients.suppliers.toolbar.merge')}
        </button>
        <button
          type='button'
          className='primary-button'
          onClick={onOpenCreateModal}
        >
          {t('clients.suppliers.toolbar.createSupplier')}
        </button>
      </div>
    </div>
  );
};

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
  const { t } = useTranslation();
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
            ? t('clients.suppliers.filters.saveFilter')
            : t('clients.suppliers.filters.saveFilterRequiresEmployee')
        }
        onApply={onApplySavedFilter}
        onDelete={onDeleteSavedFilter}
        onIconChange={onFilterIconChange}
        onNameChange={onFilterNameChange}
        onSave={onSaveFilter}
      />
      <div className='orders-filter-grid'>
        <label className='orders-filter-field'>
          <span>{t('clients.suppliers.filters.namePhoneOrOrder')}</span>
          <input
            type='text'
            value={draftFilters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
            placeholder={t('clients.suppliers.filters.namePhoneOrOrderPlaceholder')}
          />
        </label>
        <label className='orders-filter-field'>
          <span>{t('clients.suppliers.filters.supplierId')}</span>
          <input
            type='text'
            value={draftFilters.supplierId}
            onChange={(event) =>
              updateFilter('supplierId', event.target.value)
            }
            placeholder={t('clients.suppliers.filters.supplierIdPlaceholder')}
          />
        </label>
        <label className='orders-filter-field'>
          <span>{t('clients.suppliers.filters.status')}</span>
          <select
            value={draftFilters.status}
            onChange={(event) =>
              updateFilter(
                'status',
                event.target.value as SupplierStatusFilter,
              )
            }
          >
            <option value='all'>{t('clients.suppliers.filters.statusAll')}</option>
            <option value='active'>{t('clients.suppliers.filters.statusActive')}</option>
            <option value='inactive'>{t('clients.suppliers.filters.statusInactive')}</option>
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>{t('clients.suppliers.filters.dateFrom')}</span>
          <input
            type='date'
            value={draftFilters.dateFrom}
            onChange={(event) => updateFilter('dateFrom', event.target.value)}
          />
        </label>
        <label className='orders-filter-field'>
          <span>{t('clients.suppliers.filters.dateTo')}</span>
          <input
            type='date'
            value={draftFilters.dateTo}
            onChange={(event) => updateFilter('dateTo', event.target.value)}
          />
        </label>
        <label className='orders-filter-field'>
          <span>{t('clients.suppliers.filters.note')}</span>
          <input
            type='text'
            value={draftFilters.note}
            onChange={(event) => updateFilter('note', event.target.value)}
            placeholder={t('clients.suppliers.filters.notePlaceholder')}
          />
        </label>
      </div>
      <div className='orders-filter-actions'>
        <button
          type='button'
          className='toolbar-filter-button orders-filter-apply'
          onClick={onApply}
        >
          {t('clients.suppliers.filters.apply')}
        </button>
        <button
          type='button'
          className='toolbar-filter-button'
          onClick={onClear}
        >
          {t('clients.suppliers.filters.clear')}
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
}) => {
  const { t } = useTranslation();
  const columns = t('clients.suppliers.table.columns', {
    returnObjects: true,
  }) as Record<string, string>;

  return (
    <div className='orders-table-wrap'>
      <table className='orders-table clients-table'>
        <thead>
          <tr>
            <th>{columns.id}</th>
            <th>{columns.name}</th>
            <th>{columns.phone}</th>
            <th>{columns.status}</th>
            <th>{columns.created}</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr
              key={supplier.id}
              className='clients-table-row'
              onClick={() => onOpenEditModal(supplier)}
            >
              <td data-label={columns.id}>{supplier.id.slice(-6)}</td>
              <td data-label={columns.name}>{supplier.name}</td>
              <td data-label={columns.phone}>
                {getPrimarySupplierPhone(supplier)}
              </td>
              <td data-label={columns.status}>
                {supplier.isActive
                  ? t('clients.suppliers.table.statusActive')
                  : t('clients.suppliers.table.statusInactive')}
              </td>
              <td data-label={columns.created}>
                {formatDateTime(supplier.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {suppliers.length === 0 ? (
        <p className='empty-state'>{t('clients.suppliers.table.empty')}</p>
      ) : null}
    </div>
  );
};

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
  onChange: Dispatch<SetStateAction<SupplierFormState>>;
  onClose: () => void;
  onSave: () => void;
}) => {
  const { t } = useTranslation();
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const isEditing = Boolean(editingSupplierId);
  const phoneRows = form.phones?.length ? form.phones : [form.phone || ''];
  const canSave =
    !isSaving &&
    !duplicateSupplier &&
    Boolean(form.name.trim()) &&
    Boolean(form.phone.trim()) &&
    phoneRows.some((phone) => (phone || '').trim()) &&
    phoneRows.every(
      (phone) => !(phone || '').trim() || isValidUkrainianPhone(phone || ''),
    ) &&
    !hasDuplicatePhones(phoneRows);
  const updateForm = <K extends keyof SupplierFormState>(
    field: K,
    value: SupplierFormState[K],
  ) => onChange((current) => ({ ...current, [field]: value }));
  const validatePhone = (phone: string) => {
    const phoneFormatError = t('clients.messages.errors.invalidPhoneFormat');
    if (!phone.trim() || !isValidUkrainianPhone(phone)) {
      setPhoneError(phoneFormatError);
      return false;
    }
    setPhoneError(null);
    return true;
  };

  return (
    <ModalShell
      title={
        isEditing
          ? t('clients.suppliers.create.editTitle')
          : t('clients.suppliers.create.title')
      }
      onClose={onClose}
    >
      <div className='catalog-edit-body clients-modal-body'>
        <label className='field field-wide'>
          <span>{t('clients.suppliers.create.fields.name')}</span>
          <input
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
          />
        </label>
        <PhonesField
          phone={form.phone}
          phones={form.phones}
          phoneError={phoneError}
          onPhonesUpdate={(next) =>
            onChange((current) => ({
              ...current,
              phone: next.phone,
              phones: next.phones,
            }))
          }
          onClearPhoneError={() => setPhoneError(null)}
          onValidatePhone={validatePhone}
        />
        <label className='field field-wide'>
          <span>{t('clients.suppliers.create.fields.supplierOrder')}</span>
          <input
            value={form.supplierOrder}
            onChange={(event) =>
              updateForm('supplierOrder', event.target.value)
            }
          />
        </label>
        <label className='field field-wide'>
          <span>{t('clients.suppliers.create.fields.note')}</span>
          <textarea
            rows={4}
            value={form.note}
            onChange={(event) => updateForm('note', event.target.value)}
          />
        </label>
        <label className='field field-wide'>
          <span>{t('clients.suppliers.create.fields.status')}</span>
          <select
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(event) =>
              updateForm('isActive', event.target.value === 'active')
            }
          >
            <option value='active'>
              {t('clients.suppliers.create.statusActive')}
            </option>
            <option value='inactive'>
              {t('clients.suppliers.create.statusInactive')}
            </option>
          </select>
        </label>
        {duplicateSupplier ? (
          <p className='error-message'>
            {t('clients.suppliers.create.duplicateError', {
              name: duplicateSupplier.name,
            })}
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
          {isSaving
            ? t('clients.suppliers.create.saving')
            : isEditing
              ? t('clients.suppliers.create.save')
              : t('clients.suppliers.create.create')}
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
  const { t } = useTranslation();
  const canMerge =
    !isSaving && Boolean(targetId) && Boolean(sourceId) && targetId !== sourceId;

  return (
    <ModalShell title={t('clients.suppliers.merge.title')} onClose={onClose}>
      <div className='catalog-edit-body clients-modal-body'>
        <p className='muted-copy'>
          {t('clients.suppliers.merge.description')}
        </p>
        <SupplierMergeField
          label={t('clients.suppliers.merge.supplier1')}
          options={targetOptions}
          query={targetQuery}
          showSuggestions={showTargetSuggestions}
          onQueryChange={(value) => onQueryChange('target', value)}
          onSelectSupplier={(supplier) => onSelectSupplier('target', supplier)}
        />
        <SupplierMergeField
          label={t('clients.suppliers.merge.supplier2')}
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
          {isSaving
            ? t('clients.suppliers.merge.merging')
            : t('clients.suppliers.merge.mergeSuppliers')}
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
}) => {
  const { t } = useTranslation();

  return (
    <>
      <label className='field field-wide modal-suggestions-anchor'>
        <span>{label}</span>
        <input
          value={query}
          placeholder={t('clients.suppliers.merge.searchPlaceholder')}
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
};

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
        <span>{getPrimarySupplierPhone(supplier)}</span>
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
