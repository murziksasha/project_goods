import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../../shared/lib/format';
import {
  CompactPaginationPanel,
  PaginationPanel,
} from '../../../../shared/ui/PaginationPanel';
import type { Sale } from '../../../../entities/sale';
import type {
  Client,
  ClientFormValues,
  ClientHistory,
} from '../../../../entities/client';
import type {
  ClientDevice,
  ClientDeviceFormValues,
} from '../../../../entities/client-device';
import type {
  Supplier,
  SupplierFormValues,
} from '../../../../entities/supplier';
import {
  getPrimarySupplierPhone,
  getSupplierPhones,
  mapSupplierFormToPayload,
  toSupplierForm,
  type SupplierFormState,
} from '../../../../entities/supplier';
import type { Employee } from '../../../../entities/employee';
import { CatalogRecordMergeModal } from '../../../../features/catalog-duplicate-merge';
import { Button } from '../../../../shared/ui/Button';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { StatusBadge } from '../../../../shared/ui/StatusBadge';
import { CopyableValue } from '../../../../shared/ui/CopyableValue';
import { PhoneNumber } from '../shared/PhoneNumber';
import { ClientsWorkspace } from './ClientsWorkspace';
import { SupplierEditorModal } from './SupplierEditorModal';
import { filterIconOptions } from '../orders/workspace/orders-workspace-shared';
import {
  clientsSuppliersSavedFiltersStorageKey,
  type ClientFilters,
} from '../../model/clients-workspace';
import {
  readSavedFilters,
  type SavedFilter,
} from '../../model/saved-filters';
import {
  createSavedFilter as createSavedFilterRequest,
  deleteSavedFilter as deleteSavedFilterRequest,
  listSavedFilters,
} from '../../../../entities/saved-filter';
import { SavedFiltersPanel } from '../orders/workspace/SavedFiltersPanel';

type TabKey = 'clients' | 'suppliers';
type SupplierStatusFilter = 'all' | 'active' | 'inactive';
type SupplierFilters = {
  query: string;
  supplierId: string;
  status: SupplierStatusFilter;
  dateFrom: string;
  dateTo: string;
  note: string;
};

const clientsSuppliersTabStorageKey =
  'project-goods.clients-suppliers-tab';
const supplierFiltersStorageKey =
  'project-goods.suppliers-active-filters';
const defaultSupplierForm: SupplierFormState = {
  name: '',
  phone: '+380',
  phones: ['+380'],
  supplierOrder: '',
  note: '',
  isActive: true,
};
const clientsSuppliersTabs: Array<{ key: TabKey; labelKey: string }> =
  [
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
    const storedTab = window.localStorage.getItem(
      clientsSuppliersTabStorageKey,
    );
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
        window.localStorage.getItem(supplierFiltersStorageKey) ??
          '{}',
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

const toSupplierPayload = (
  form: SupplierFormState,
): SupplierFormValues => mapSupplierFormToPayload(form);

const getSearchText = (supplier: Supplier) =>
  [
    supplier.name,
    ...getSupplierPhones(supplier),
    supplier.note,
    supplier.supplierOrder,
  ]
    .join(' ')
    .toLowerCase();

const normalizeSupplierPhoneDigits = (phone: string) =>
  phone.replace(/\D/g, '');

const findDuplicateSupplier = (
  suppliers: Supplier[],
  form: SupplierFormState,
  editingSupplierId: string | null,
) => {
  const name = form.name.trim().toLowerCase();
  const formPhoneDigits = (
    form.phones?.length ? form.phones : [form.phone]
  )
    .map((phone) => normalizeSupplierPhoneDigits(phone || ''))
    .filter((phone) => phone.length > 0);

  return suppliers.find((supplier) => {
    if (editingSupplierId && supplier.id === editingSupplierId) {
      return false;
    }

    const sameName =
      name.length > 0 && supplier.name.trim().toLowerCase() === name;
    const supplierPhoneDigits = getSupplierPhones(supplier).map(
      (phone) => normalizeSupplierPhoneDigits(phone),
    );
    const samePhone = formPhoneDigits.some((phoneDigits) =>
      supplierPhoneDigits.includes(phoneDigits),
    );

    return sameName || samePhone;
  });
};

export interface ClientsSuppliersWorkspaceProps {
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
  isSupplierImporting?: boolean;
  isSupplierExporting?: boolean;
  onSelectClient: (clientId: string | null) => void;
  onDeleteClient: (client: Client) => Promise<void>;
  onCreateClient: (payload: ClientFormValues) => Promise<boolean>;
  onImportClients: (file: File) => Promise<boolean>;
  onExportClients: () => Promise<void>;
  onImportSuppliers?: (file: File) => Promise<boolean>;
  onExportSuppliers?: () => Promise<void>;
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
  clientDevices: ClientDevice[];
  onUpdateClientDevice: (
    deviceId: string,
    payload: ClientDeviceFormValues,
  ) => Promise<boolean>;
  onDeleteClientDevice: (deviceId: string) => Promise<boolean>;
}

export const ClientsSuppliersWorkspace: React.FC<
  ClientsSuppliersWorkspaceProps
> = ({
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
  isSupplierImporting = false,
  isSupplierExporting = false,
  onSelectClient,
  onDeleteClient,
  onCreateClient,
  onImportClients,
  onExportClients,
  onImportSuppliers,
  onExportSuppliers,
  onMergeClients,
  onUpdateClient,
  onOpenSaleCard,
  openClientCardRequestId,
  onOpenClientCardHandled,
  onCreateSupplier,
  onMergeSuppliers,
  onUpdateSupplier,
  clientDevices,
  onUpdateClientDevice,
  onDeleteClientDevice,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>(
    getStoredClientsSuppliersTab,
  );
  const [isSupplierFilterOpen, setIsSupplierFilterOpen] =
    useState(false);
  const [draftSupplierFilters, setDraftSupplierFilters] =
    useState<SupplierFilters>(readSupplierFilters);
  const [appliedSupplierFilters, setAppliedSupplierFilters] =
    useState<SupplierFilters>(readSupplierFilters);
  const [savedFilters, setSavedFilters] = useState<
    Array<SavedFilter<ClientFilters | SupplierFilters, TabKey>>
  >([]);
  const [newSupplierFilterName, setNewSupplierFilterName] =
    useState('');
  const [newSupplierFilterIcon, setNewSupplierFilterIcon] = useState(
    filterIconOptions[0],
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<
    string | null
  >(null);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [suppliersPage, setSuppliersPage] = useState(1);
  const [suppliersPageSize, setSuppliersPageSize] = useState(30);
  const [form, setForm] = useState<SupplierFormState>(
    defaultSupplierForm,
  );
  const supplierImportInputRef = useRef<HTMLInputElement | null>(
    null,
  );

  const handleSupplierImportFileSelect = async (
    file: File | null,
  ) => {
    if (!file || !onImportSuppliers) return;

    const isSuccess = await onImportSuppliers(file);
    if (isSuccess) {
      setSuppliersPage(1);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const filters = appliedSupplierFilters;
    const normalized = filters.query.trim().toLowerCase();
    const supplierId = filters.supplierId.trim().toLowerCase();
    const note = filters.note.trim().toLowerCase();
    const sortedSuppliers = [...suppliers].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    return sortedSuppliers.filter((supplier) => {
      if (
        normalized &&
        !getSearchText(supplier).includes(normalized)
      ) {
        return false;
      }
      if (
        supplierId &&
        !supplier.id.toLowerCase().includes(supplierId)
      ) {
        return false;
      }
      if (note && !supplier.note.toLowerCase().includes(note))
        return false;
      if (filters.status === 'active' && !supplier.isActive)
        return false;
      if (filters.status === 'inactive' && supplier.isActive)
        return false;
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

  const handleSaveSupplier = async () => {
    const payload = toSupplierPayload(form);

    if (!payload.name || !payload.phone) return;

    const isSuccess = editingSupplierId
      ? await onUpdateSupplier(editingSupplierId, payload)
      : await onCreateSupplier(payload);

    if (!isSuccess) return;
    setIsCreateModalOpen(false);
  };

  const applySupplierFilters = () => {
    const nextFilters = normalizeSupplierFilters(
      draftSupplierFilters,
    );
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

  useEffect(() => {
    if (!currentEmployee?.id) {
      setSavedFilters([]);
      return;
    }
    let cancelled = false;
    const employeeId = currentEmployee.id;
    void (async () => {
      try {
        let remote = await listSavedFilters<
          ClientFilters | SupplierFilters
        >('clients');
        if (remote.length === 0) {
          const legacy = readSavedFilters<
            ClientFilters | SupplierFilters,
            TabKey
          >(clientsSuppliersSavedFiltersStorageKey, [
            'clients',
            'suppliers',
          ]).filter((item) => item.employeeId === employeeId);
          const migrated: Array<
            SavedFilter<ClientFilters | SupplierFilters, TabKey>
          > = [];
          for (const item of legacy) {
            try {
              const created = await createSavedFilterRequest({
                scope: 'clients',
                tab: item.tab,
                name: item.name,
                icon: item.icon,
                filters: item.filters,
              });
              migrated.push({
                id: created.id,
                employeeId: created.employeeId,
                name: created.name,
                icon: created.icon,
                tab: created.tab as TabKey,
                filters: created.filters as
                  | ClientFilters
                  | SupplierFilters,
                createdAt: created.createdAt,
              });
            } catch {
              // skip
            }
          }
          if (migrated.length > 0) {
            remote = migrated.map((item) => ({
              id: item.id,
              employeeId: item.employeeId,
              scope: 'clients' as const,
              tab: item.tab,
              name: item.name,
              icon: item.icon,
              filters: item.filters,
              createdAt: item.createdAt,
            }));
            try {
              window.localStorage.removeItem(
                clientsSuppliersSavedFiltersStorageKey,
              );
            } catch {
              // ignore
            }
          }
        }
        if (!cancelled) {
          setSavedFilters(
            remote.map((item) => ({
              id: item.id,
              employeeId: item.employeeId,
              name: item.name,
              icon: item.icon,
              tab: item.tab as TabKey,
              filters: item.filters as
                | ClientFilters
                | SupplierFilters,
              createdAt: item.createdAt,
            })),
          );
        }
      } catch {
        // keep empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentEmployee?.id]);

  const saveSupplierFilter = () => {
    const filterName = newSupplierFilterName.trim();
    if (!currentEmployee?.id || !filterName) return;
    const filters = normalizeSupplierFilters(appliedSupplierFilters);
    void (async () => {
      try {
        const created = await createSavedFilterRequest({
          scope: 'clients',
          tab: 'suppliers',
          name: filterName,
          icon: newSupplierFilterIcon,
          filters,
        });
        setSavedFilters((current) => [
          {
            id: created.id,
            employeeId: created.employeeId,
            name: created.name,
            icon: created.icon,
            tab: 'suppliers',
            filters: created.filters as SupplierFilters,
            createdAt: created.createdAt,
          },
          ...current,
        ]);
        setNewSupplierFilterName('');
        setNewSupplierFilterIcon(filterIconOptions[0]);
      } catch {
        // ignore
      }
    })();
  };

  const applySupplierSavedFilter = (filterId: string) => {
    const savedFilter = savedFilters.find(
      (item) => item.id === filterId,
    );
    if (!savedFilter || savedFilter.tab !== 'suppliers') return;
    const nextFilters = normalizeSupplierFilters(
      savedFilter.filters as SupplierFilters,
    );
    setDraftSupplierFilters(nextFilters);
    setAppliedSupplierFilters(nextFilters);
    setSuppliersPage(1);
  };

  const removeSupplierSavedFilter = (filterId: string) => {
    void (async () => {
      try {
        await deleteSavedFilterRequest(filterId);
        setSavedFilters((current) =>
          current.filter((item) => item.id !== filterId),
        );
      } catch {
        // ignore
      }
    })();
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
      window.localStorage.setItem(
        clientsSuppliersTabStorageKey,
        activeTab,
      );
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

  return (
    <section className='panel clients-workspace'>
      <ClientsSuppliersTabs
        activeTab={activeTab}
        clientsCount={clients.length}
        suppliersCount={suppliers.length}
        onChange={setActiveTab}
      />

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
          clientDevices={clientDevices}
          onUpdateClientDevice={onUpdateClientDevice}
          onDeleteClientDevice={onDeleteClientDevice}
        />
      ) : (
        <SuppliersWorkspace
          activeFiltersCount={activeSupplierFiltersCount}
          canSaveFilter={Boolean(currentEmployee?.id)}
          draftFilters={draftSupplierFilters}
          isFilterOpen={isSupplierFilterOpen}
          isImporting={isSupplierImporting}
          isExporting={isSupplierExporting}
          isBusy={isSaving}
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
          onOpenImport={() => supplierImportInputRef.current?.click()}
          onOpenExport={() => {
            void onExportSuppliers?.();
          }}
          onOpenMergeModal={() => setIsMergeModalOpen(true)}
          onSaveFilter={saveSupplierFilter}
          onToggleFilters={() =>
            setIsSupplierFilterOpen((current) => !current)
          }
          onUpdateFilters={setDraftSupplierFilters}
        />
      )}

      <input
        ref={supplierImportInputRef}
        type='file'
        className='clients-import-input'
        accept='.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = '';
          void handleSupplierImportFileSelect(file);
        }}
      />

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
        <CatalogRecordMergeModal<Supplier>
          isOpen={isMergeModalOpen}
          title={t('clients.suppliers.merge.title')}
          records={suppliers}
          searchPlaceholder={t(
            'catalog.recordMergeModal.searchSupplierPlaceholder',
          )}
          isSaving={isSaving}
          onClose={() => setIsMergeModalOpen(false)}
          onMerge={async (targetId, sourceId) => {
            return onMergeSuppliers(targetId, sourceId);
          }}
          getRecordId={(supplier) => supplier.id}
          getRecordName={(supplier) => supplier.name}
          getRecordSecondaryText={(supplier) =>
            getPrimarySupplierPhone(supplier) || supplier.phone
          }
          getRecordNote={(supplier) => supplier.note}
          matchesRecord={(supplier, query) => {
            const normalized = query.trim().toLowerCase();
            if (!normalized) return true;
            return `${supplier.name} ${getSupplierPhones(supplier).join(' ')}`
              .toLowerCase()
              .includes(normalized);
          }}
        />
      ) : null}
    </section>
  );
};

const ClientsSuppliersTabs = ({
  activeTab,
  clientsCount,
  suppliersCount,
  onChange,
}: {
  activeTab: TabKey;
  clientsCount: number;
  suppliersCount: number;
  onChange: (tab: TabKey) => void;
}) => {
  const { t } = useTranslation();
  const counts: Record<TabKey, number> = {
    clients: clientsCount,
    suppliers: suppliersCount,
  };

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
          role='tab'
          aria-selected={activeTab === tab.key}
          className={
            activeTab === tab.key
              ? 'orders-tab orders-tab-active'
              : 'orders-tab'
          }
          onClick={() => onChange(tab.key)}
        >
          {t('clients.tabs.withCount', {
            label: t(tab.labelKey),
            count: counts[tab.key],
          })}
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
  isImporting,
  isExporting,
  isBusy,
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
  onOpenImport,
  onOpenExport,
  onOpenMergeModal,
  onSaveFilter,
  onToggleFilters,
  onUpdateFilters,
}: {
  activeFiltersCount: number;
  canSaveFilter: boolean;
  draftFilters: SupplierFilters;
  isFilterOpen: boolean;
  isImporting: boolean;
  isExporting: boolean;
  isBusy: boolean;
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
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenMergeModal: () => void;
  onSaveFilter: () => void;
  onToggleFilters: () => void;
  onUpdateFilters: (filters: SupplierFilters) => void;
}) => (
  <section className='panel clients-workspace'>
    <SuppliersToolbar
      activeFiltersCount={activeFiltersCount}
      isFilterOpen={isFilterOpen}
      isImporting={isImporting}
      isExporting={isExporting}
      isBusy={isBusy}
      query={query}
      totalSuppliersCount={totalSuppliersCount}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onQueryChange={onQueryChange}
      onOpenCreateModal={onOpenCreateModal}
      onOpenImport={onOpenImport}
      onOpenExport={onOpenExport}
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
    <SuppliersTable
      suppliers={suppliers}
      onOpenEditModal={onOpenEditModal}
    />
    <PaginationPanel
      totalItems={totalSuppliersCount}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  </section>
);

const SuppliersToolbar = ({
  activeFiltersCount,
  isFilterOpen,
  isImporting,
  isExporting,
  isBusy,
  query,
  totalSuppliersCount,
  page,
  pageSize,
  onPageChange,
  onQueryChange,
  onOpenCreateModal,
  onOpenImport,
  onOpenExport,
  onOpenMergeModal,
  onToggleFilters,
}: {
  activeFiltersCount: number;
  isFilterOpen: boolean;
  isImporting: boolean;
  isExporting: boolean;
  isBusy: boolean;
  query: string;
  totalSuppliersCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onOpenCreateModal: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenMergeModal: () => void;
  onToggleFilters: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className='clients-toolbar-shell'>
      <PageHeader
        title={t('clients.tabs.suppliers')}
        subtitle={t('clients.toolbar.totalCount', {
          count: totalSuppliersCount,
          defaultValue: '{{count}} records',
        })}
      />
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
              placeholder={t(
                'clients.suppliers.toolbar.searchPlaceholder',
              )}
              aria-label={t(
                'clients.suppliers.toolbar.searchAriaLabel',
              )}
            />
            {query ? (
              <span
                role='button'
                tabIndex={0}
                className='orders-search-clear'
                aria-label={t(
                  'clients.suppliers.toolbar.clearSearchAriaLabel',
                )}
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
          <Button
            variant='success'
            onClick={onOpenImport}
            disabled={isBusy || isImporting || isExporting}
          >
            {isImporting
              ? t('clients.suppliers.toolbar.importing')
              : t('clients.suppliers.toolbar.importXls')}
          </Button>
          <Button
            variant='secondary'
            onClick={onOpenExport}
            disabled={isBusy || isImporting || isExporting}
          >
            {isExporting
              ? t('clients.suppliers.toolbar.exporting')
              : t('clients.suppliers.toolbar.exportXls')}
          </Button>
          <Button
            variant='ghost'
            onClick={onOpenMergeModal}
            disabled={isBusy || isImporting}
          >
            {t('clients.suppliers.toolbar.merge')}
          </Button>
          <Button
            variant='success'
            className='orders-create-button'
            onClick={onOpenCreateModal}
            disabled={isBusy || isImporting}
          >
            {t('clients.suppliers.toolbar.createSupplier')}
          </Button>
        </div>
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
            : t(
                'clients.suppliers.filters.saveFilterRequiresEmployee',
              )
        }
        onApply={onApplySavedFilter}
        onDelete={onDeleteSavedFilter}
        onIconChange={onFilterIconChange}
        onNameChange={onFilterNameChange}
        onSave={onSaveFilter}
      />
      <div className='orders-filter-grid'>
        <label className='orders-filter-field'>
          <span>
            {t('clients.suppliers.filters.namePhoneOrOrder')}
          </span>
          <input
            type='text'
            value={draftFilters.query}
            onChange={(event) =>
              updateFilter('query', event.target.value)
            }
            placeholder={t(
              'clients.suppliers.filters.namePhoneOrOrderPlaceholder',
            )}
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
            placeholder={t(
              'clients.suppliers.filters.supplierIdPlaceholder',
            )}
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
            <option value='all'>
              {t('clients.suppliers.filters.statusAll')}
            </option>
            <option value='active'>
              {t('clients.suppliers.filters.statusActive')}
            </option>
            <option value='inactive'>
              {t('clients.suppliers.filters.statusInactive')}
            </option>
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>{t('clients.suppliers.filters.dateFrom')}</span>
          <input
            type='date'
            value={draftFilters.dateFrom}
            onChange={(event) =>
              updateFilter('dateFrom', event.target.value)
            }
          />
        </label>
        <label className='orders-filter-field'>
          <span>{t('clients.suppliers.filters.dateTo')}</span>
          <input
            type='date'
            value={draftFilters.dateTo}
            onChange={(event) =>
              updateFilter('dateTo', event.target.value)
            }
          />
        </label>
        <label className='orders-filter-field'>
          <span>{t('clients.suppliers.filters.note')}</span>
          <input
            type='text'
            value={draftFilters.note}
            onChange={(event) =>
              updateFilter('note', event.target.value)
            }
            placeholder={t(
              'clients.suppliers.filters.notePlaceholder',
            )}
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
      <table className='orders-table clients-table suppliers-table'>
        <thead>
          <tr>
            <th>{columns.name}</th>
            <th>{columns.status}</th>
            <th>{columns.phone}</th>
            <th>{columns.created}</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.length === 0 ? (
            <tr>
              <td colSpan={4} className='orders-empty'>
                {t('clients.suppliers.table.empty')}
              </td>
            </tr>
          ) : (
            suppliers.map((supplier) => {
              const phone = getPrimarySupplierPhone(supplier);
              return (
                <tr
                  key={supplier.id}
                  className='clients-table-row'
                  onClick={() => onOpenEditModal(supplier)}
                >
                  <td data-label={columns.name}>
                    <CopyableValue value={supplier.name}>
                      {supplier.name}
                    </CopyableValue>
                  </td>
                  <td data-label={columns.status}>
                    <StatusBadge
                      tone={supplier.isActive ? 'success' : 'gray'}
                      label={
                        supplier.isActive
                          ? t('clients.suppliers.table.statusActive')
                          : t(
                              'clients.suppliers.table.statusInactive',
                            )
                      }
                    />
                  </td>
                  <td data-label={columns.phone}>
                    {phone ? (
                      <CopyableValue value={phone}>
                        <a
                          href={`tel:${phone}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <PhoneNumber value={phone} />
                        </a>
                      </CopyableValue>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td data-label={columns.created}>
                    {formatDateTime(supplier.createdAt)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
