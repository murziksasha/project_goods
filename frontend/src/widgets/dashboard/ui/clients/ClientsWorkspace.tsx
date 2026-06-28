import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { Employee } from '../../../../entities/employee/model/types';
import type {
  Client,
  ClientFormValues,
  ClientHistory,
  ClientStatus,
} from '../../../../entities/client/model/types';
import { clientMatchesPhoneQuery } from '../../../../entities/client/lib/phone-match';
import { clientStatusOptions } from '../../../../entities/client/model/constants';
import type { Sale } from '../../../../entities/sale/model/types';
import type {
  ClientDevice,
  ClientDeviceFormValues,
} from '../../../../entities/client-device/model/types';
import {
  isValidUkrainianPhone,
  normalizePhone,
} from '../../../../shared/lib/phoneFormatter';
import { PaginationPanel } from '../../../../shared/ui/PaginationPanel';
import { ClientCardModal } from './ClientCardModal';
import { ClientCreateModal } from './ClientCreateModal';
import { ClientMergeModal, type ClientMergeField } from './ClientMergeModal';
import { ClientsFilterPanel } from './ClientsFilterPanel';
import { ClientsTable } from './ClientsTable';
import { ClientsToolbar } from './ClientsToolbar';
import {
  clientCardTabStorageKey,
  clientsSuppliersSavedFiltersStorageKey,
  clientsFiltersStorageKey,
  emptyClientDraft,
  emptyFilters,
  getActiveClientFiltersCount,
  getClientSaleIncome,
  getClientStatsMap,
  getClientSubtitle,
  getFilteredClients,
  getStoredClientCardTab,
  isOptionalAddressValid,
  isOptionalIbanValid,
  isOptionalRegistrationIdValid,
  normalizeClientFiltersForApply,
  mapClientDraftToPayload,
  type ClientCardTab,
  type ClientDraft,
  type ClientFilters,
  type ClientMainForm,
} from '../../model/clients-workspace';
import { filterIconOptions } from '../orders/workspace/orders-workspace-shared';
import {
  createSavedFilterId,
  readSavedFilters,
  type SavedFilter,
} from '../../model/saved-filters';

type ClientsWorkspaceProps = {
  currentEmployee: Employee | null;
  clients: Client[];
  sales: Sale[];
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
  onUpdateClient: (
    clientId: string,
    payload: ClientFormValues,
  ) => Promise<boolean>;
  onOpenSaleCard: (sale: Sale) => void;
  openClientCardRequestId?: string | null;
  onOpenClientCardHandled?: () => void;
  clientDevices: ClientDevice[];
  onUpdateClientDevice: (
    deviceId: string,
    payload: ClientDeviceFormValues,
  ) => Promise<boolean>;
  onDeleteClientDevice: (deviceId: string) => Promise<boolean>;
};

const MAX_PHONE_LENGTH = 10;

const getMetaFieldFromNote = (
  note: string,
  key: 'Address' | 'Email',
) => {
  const prefix = `${key}:`;
  const line = note
    .split('\n')
    .find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
};

const getMetaFieldFromNoteLegacy = (
  note: string,
  key: 'Address' | 'Email',
) => {
  const prefix = `${key}:`;
  const line = note
    .split('\n')
    .find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
};

const getPlainNote = (note: string) =>
  note
    .split('\n')
    .filter(
      (line) =>
        !line.startsWith('Address:') &&
        !line.startsWith('Email:') &&
        !line.startsWith('Address:') &&
        !line.startsWith('Email:'),
    )
    .join('\n')
    .trim();

const getLegacyClientEmail = (client: Client) =>
  client.email ||
  getMetaFieldFromNote(client.note, 'Email') ||
  getMetaFieldFromNoteLegacy(client.note, 'Email');

const getLegacyClientAddress = (client: Client) =>
  client.address ||
  getMetaFieldFromNote(client.note, 'Address') ||
  getMetaFieldFromNoteLegacy(client.note, 'Address');

export const ClientsWorkspace = ({
  currentEmployee,
  clients,
  sales,
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
  openClientCardRequestId = null,
  onOpenClientCardHandled,
  clientDevices,
  onUpdateClientDevice,
  onDeleteClientDevice,
}: ClientsWorkspaceProps) => {
  const { t } = useTranslation();
  const filterStatusOptions = useMemo(
    (): Array<{
      labelKey: string;
      value: ClientStatus | 'all';
    }> => [{ labelKey: 'clients.filters.statusAll', value: 'all' }, ...clientStatusOptions],
    [],
  );
  const [isFilterOpen, setIsFilterOpen] = useState(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(clientsFiltersStorageKey) ?? '{}') as Partial<{
        isFilterOpen: boolean;
      }>;
      return Boolean(parsed.isFilterOpen);
    } catch {
      return false;
    }
  });
  const [draftFilters, setDraftFilters] =
    useState<ClientFilters>(() => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(clientsFiltersStorageKey) ?? '{}') as Partial<{
          draftFilters: ClientFilters;
          appliedFilters: ClientFilters;
          searchValue: string;
          isFilterOpen: boolean;
        }>;
        return { ...emptyFilters, ...(parsed.draftFilters ?? {}) };
      } catch {
        return emptyFilters;
      }
    });
  const [appliedFilters, setAppliedFilters] =
    useState<ClientFilters>(() => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(clientsFiltersStorageKey) ?? '{}') as Partial<{
          draftFilters: ClientFilters;
          appliedFilters: ClientFilters;
          searchValue: string;
          isFilterOpen: boolean;
        }>;
        return { ...emptyFilters, ...(parsed.appliedFilters ?? {}) };
      } catch {
        return emptyFilters;
      }
    });
  const [searchValue, setSearchValue] = useState(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(clientsFiltersStorageKey) ?? '{}') as Partial<{
        searchValue: string;
      }>;
      return parsed.searchValue ?? '';
    } catch {
      return '';
    }
  });
  const [savedFilters, setSavedFilters] = useState<
    Array<SavedFilter<ClientFilters, 'clients' | 'suppliers'>>
  >(() =>
    readSavedFilters<ClientFilters, 'clients' | 'suppliers'>(
      clientsSuppliersSavedFiltersStorageKey,
      ['clients', 'suppliers'],
    ),
  );
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterIcon, setNewFilterIcon] = useState(filterIconOptions[0]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isClientCardOpen, setIsClientCardOpen] = useState(false);
  const [clientCardTab, setClientCardTab] =
    useState<ClientCardTab>(getStoredClientCardTab);
  const [personForm, setPersonForm] = useState({
    ...emptyClientDraft,
  });
  const [mergeTargetQuery, setMergeTargetQuery] = useState('');
  const [mergeSourceQuery, setMergeSourceQuery] = useState('');
  const [showMergeTargetSuggestions, setShowMergeTargetSuggestions] =
    useState(false);
  const [showMergeSourceSuggestions, setShowMergeSourceSuggestions] =
    useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mainTabForm, setMainTabForm] = useState<ClientMainForm>({
    name: '',
    phone: '',
    phones: [''],
    email: '',
    address: '',
    registrationId: '',
    iban: '',
    note: '',
    status: '' as ClientStatus | '',
  });
  const [mainTabPhoneError, setMainTabPhoneError] = useState<
    string | null
  >(null);
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsPageSize, setClientsPageSize] = useState(30);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const isMainTabDirtyRef = useRef(false);
  const hydratedClientIdRef = useRef<string | null>(null);
  const hydratedUpdatedAtRef = useRef<string | null>(null);

  const statsByClient = useMemo(
    () => getClientStatsMap(sales),
    [sales],
  );

  const activeFiltersCount = useMemo(
    () => getActiveClientFiltersCount(appliedFilters),
    [appliedFilters],
  );
  const visibleSavedFilters = useMemo(
    () =>
      currentEmployee?.id
        ? savedFilters
            .filter(
              (item) =>
                item.employeeId === currentEmployee.id &&
                item.tab === 'clients',
            )
            .sort(
              (first, second) =>
                new Date(second.createdAt).getTime() -
                new Date(first.createdAt).getTime(),
            )
        : [],
    [currentEmployee?.id, savedFilters],
  );

  const filteredClients = useMemo(
    () => getFilteredClients(clients, appliedFilters, statsByClient),
    [appliedFilters, clients, statsByClient],
  );
  const paginatedClients = useMemo(() => {
    const start = (clientsPage - 1) * clientsPageSize;
    return filteredClients.slice(start, start + clientsPageSize);
  }, [clientsPage, clientsPageSize, filteredClients]);

  const selectedClient = useMemo(
    () =>
      clients.find((client) => client.id === selectedClientId) ??
      null,
    [clients, selectedClientId],
  );

  useEffect(() => {
    if (!selectedClient || !selectedClientId) return;

    const clientChanged = hydratedClientIdRef.current !== selectedClientId;
    const serverChanged =
      hydratedUpdatedAtRef.current !== selectedClient.updatedAt;

    if (!clientChanged && !serverChanged) return;
    if (!clientChanged && isMainTabDirtyRef.current) return;

    const phones = selectedClient.phones?.length
      ? [...selectedClient.phones]
      : [selectedClient.phone || ''];
    setMainTabForm({
      name: selectedClient.name,
      phone: phones[0] || selectedClient.phone || '',
      phones,
      email: getLegacyClientEmail(selectedClient),
      address: getLegacyClientAddress(selectedClient),
      registrationId: selectedClient.registrationId,
      iban: selectedClient.iban,
      note: getPlainNote(selectedClient.note),
      status: selectedClient.status || '',
    });
    hydratedClientIdRef.current = selectedClientId;
    hydratedUpdatedAtRef.current = selectedClient.updatedAt;
    isMainTabDirtyRef.current = false;
  }, [selectedClient, selectedClientId]);

  useEffect(() => {
    if (!openClientCardRequestId) return;
    onSelectClient(openClientCardRequestId);
    setClientCardTab('main');
    setIsClientCardOpen(true);
    onOpenClientCardHandled?.();
  }, [
    onOpenClientCardHandled,
    onSelectClient,
    openClientCardRequestId,
  ]);

  useEffect(() => {
    if (!isClientCardOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isClientCardOpen]);

  const selectedHistorySales =
    history?.client.id === selectedClientId ? history.sales : [];
  const servicesHistory = selectedHistorySales.filter(
    (sale) => sale.kind === 'repair',
  );
  const salesHistory = selectedHistorySales.filter(
    (sale) => sale.kind === 'sale',
  );
  const activeHistoryRows =
    clientCardTab === 'services' ? servicesHistory : salesHistory;

  const mergeTargetOptions = useMemo(() => {
    const query = mergeTargetQuery.trim();
    if (!query) return [];

    return clients
      .filter((client) => clientMatchesPhoneQuery(client, query))
      .slice(0, 6);
  }, [clients, mergeTargetQuery]);

  const mergeSourceOptions = useMemo(() => {
    const query = mergeSourceQuery.trim();
    if (!query) return [];

    return clients
      .filter((client) => clientMatchesPhoneQuery(client, query))
      .slice(0, 6);
  }, [clients, mergeSourceQuery]);

  const handleMergeQueryChange = (
    field: ClientMergeField,
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

  const handleMergeClientSelect = (
    field: ClientMergeField,
    client: Client,
  ) => {
    if (field === 'target') {
      setMergeTargetId(client.id);
      setMergeTargetQuery(getClientSubtitle(client));
      setShowMergeTargetSuggestions(false);
      return;
    }

    setMergeSourceId(client.id);
    setMergeSourceQuery(getClientSubtitle(client));
    setShowMergeSourceSuggestions(false);
  };

  const applyFilters = () => {
    const next = normalizeClientFiltersForApply(draftFilters);

    setDraftFilters(next);
    setAppliedFilters(next);
    setClientsPage(1);
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setClientsPage(1);
  };
  const saveCurrentFilter = () => {
    const filterName = newFilterName.trim();
    if (!currentEmployee?.id || !filterName) return;
    const nextFilter: SavedFilter<ClientFilters, 'clients' | 'suppliers'> = {
      id: createSavedFilterId('client-filter'),
      employeeId: currentEmployee.id,
      name: filterName,
      icon: newFilterIcon,
      tab: 'clients',
      filters: normalizeClientFiltersForApply(appliedFilters),
      createdAt: new Date().toISOString(),
    };
    setSavedFilters((current) => [nextFilter, ...current]);
    setNewFilterName('');
    setNewFilterIcon(filterIconOptions[0]);
  };
  const applySavedFilter = (filterId: string) => {
    const savedFilter = savedFilters.find((item) => item.id === filterId);
    if (!savedFilter) return;
    const nextFilters = normalizeClientFiltersForApply(savedFilter.filters);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSearchValue(nextFilters.query);
    setClientsPage(1);
  };
  const removeSavedFilter = (filterId: string) => {
    setSavedFilters((current) =>
      current.filter((item) => item.id !== filterId),
    );
  };

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredClients.length / clientsPageSize),
    );
    if (clientsPage > pageCount) {
      setClientsPage(pageCount);
    }
  }, [clientsPage, clientsPageSize, filteredClients.length]);

  useEffect(() => {
    window.localStorage.setItem(
      clientsFiltersStorageKey,
      JSON.stringify({
        draftFilters,
        appliedFilters,
        searchValue,
        isFilterOpen,
      }),
    );
  }, [appliedFilters, draftFilters, isFilterOpen, searchValue]);

  useEffect(() => {
    window.localStorage.setItem(
      clientsSuppliersSavedFiltersStorageKey,
      JSON.stringify(savedFilters),
    );
  }, [savedFilters]);

  useEffect(() => {
    try {
      window.localStorage.setItem(clientCardTabStorageKey, clientCardTab);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [clientCardTab]);

  const openClientCard = (clientId: string) => {
    onSelectClient(clientId);
    setClientCardTab('main');
    setIsClientCardOpen(true);
  };

  const closeClientCard = () => {
    setIsClientCardOpen(false);
    onSelectClient(null);
    isMainTabDirtyRef.current = false;
    hydratedClientIdRef.current = null;
    hydratedUpdatedAtRef.current = null;
  };

  const handleMainTabFormChange: Dispatch<SetStateAction<ClientMainForm>> = (
    value,
  ) => {
    isMainTabDirtyRef.current = true;
    setMainTabForm(value);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneFormatError = t('clients.messages.errors.invalidPhoneFormat');
    const normalized = normalizePhone(phone);
    if (normalized.length === 0) {
      setMainTabPhoneError(phoneFormatError);
      return false;
    }
    if (normalized.length > MAX_PHONE_LENGTH) {
      setMainTabPhoneError(phoneFormatError);
      return false;
    }
    if (!isValidUkrainianPhone(phone)) {
      setMainTabPhoneError(phoneFormatError);
      return false;
    }
    setMainTabPhoneError(null);
    return true;
  };

  const handleCreateClient = async () => {
    const payload = mapClientDraftToPayload(personForm);
    if (!payload.phone || !payload.name) return;
    if (
      !isOptionalAddressValid(payload.address) ||
      !isOptionalRegistrationIdValid(payload.registrationId) ||
      !isOptionalIbanValid(payload.iban)
    ) {
      return;
    }

    const isSuccess = await onCreateClient(payload);
    if (!isSuccess) return;

    setIsCreateModalOpen(false);
    setPersonForm({
      ...emptyClientDraft,
    });
  };

  const handleMergeClients = async () => {
    if (
      !mergeTargetId ||
      !mergeSourceId ||
      mergeTargetId === mergeSourceId
    )
      return;

    const isSuccess = await onMergeClients(
      mergeTargetId,
      mergeSourceId,
    );
    if (!isSuccess) return;

    setIsMergeModalOpen(false);
    setMergeTargetQuery('');
    setMergeSourceQuery('');
    setMergeTargetId('');
    setMergeSourceId('');
  };

  const handleMainTabSave = async () => {
    if (!selectedClientId) return;

    if (
      !isOptionalAddressValid(mainTabForm.address) ||
      !isOptionalRegistrationIdValid(mainTabForm.registrationId) ||
      !isOptionalIbanValid(mainTabForm.iban)
    ) {
      return;
    }

    const draftForSave: ClientDraft = {
      phone: mainTabForm.phone,
      phones: mainTabForm.phones || [],
      name: mainTabForm.name,
      address: mainTabForm.address,
      email: mainTabForm.email,
      registrationId: mainTabForm.registrationId,
      iban: mainTabForm.iban,
      note: mainTabForm.note,
    };
    const payload = mapClientDraftToPayload(draftForSave, mainTabForm.status as ClientStatus | '');
    const isSuccess = await onUpdateClient(selectedClientId, payload);
    if (isSuccess) {
      isMainTabDirtyRef.current = false;
    }
  };

  const handleImportFileSelect = async (file: File | null) => {
    if (!file) return;

    const isSuccess = await onImportClients(file);
    if (isSuccess) {
      setClientsPage(1);
    }
  };

  const openSaleCardFromClientModal = (sale: Sale) => {
    closeClientCard();
    onOpenSaleCard(sale);
  };

  return (
    <section className='panel clients-workspace'>
      <ClientsToolbar
        activeFiltersCount={activeFiltersCount}
        filteredClientsCount={filteredClients.length}
        isFilterOpen={isFilterOpen}
        page={clientsPage}
        pageSize={clientsPageSize}
        searchValue={searchValue}
        onPageChange={setClientsPage}
        onToggleFilters={() => setIsFilterOpen((current) => !current)}
        onSearchChange={(nextQuery) => {
          setSearchValue(nextQuery);
          setDraftFilters((current) => ({
            ...current,
            query: nextQuery.trim(),
          }));
          setAppliedFilters((current) => ({
            ...current,
            query: nextQuery.trim(),
          }));
          setClientsPage(1);
        }}
        onClearSearch={() => {
          setSearchValue('');
          setDraftFilters((current) => ({
            ...current,
            query: '',
          }));
          setAppliedFilters((current) => ({
            ...current,
            query: '',
          }));
          setClientsPage(1);
        }}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenExport={() => {
          void onExportClients();
        }}
        onOpenImport={() => importInputRef.current?.click()}
        onOpenMergeModal={() => setIsMergeModalOpen(true)}
        isExporting={isClientExporting}
        isImporting={isClientImporting}
        isBusy={isSaving}
      />
      <input
        ref={importInputRef}
        type='file'
        className='clients-import-input'
        accept='.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = '';
          void handleImportFileSelect(file);
        }}
      />

      <ClientsFilterPanel
        draftFilters={draftFilters}
        isOpen={isFilterOpen}
        statusOptions={filterStatusOptions}
        savedFilters={visibleSavedFilters.map((item) => ({
          id: item.id,
          name: item.name,
          icon: item.icon,
        }))}
        canSaveFilter={Boolean(currentEmployee?.id)}
        newFilterIcon={newFilterIcon}
        newFilterName={newFilterName}
        onApply={applyFilters}
        onApplySavedFilter={applySavedFilter}
        onChange={setDraftFilters}
        onClear={clearFilters}
        onDeleteSavedFilter={removeSavedFilter}
        onFilterIconChange={setNewFilterIcon}
        onFilterNameChange={setNewFilterName}
        onSaveFilter={saveCurrentFilter}
      />

      <ClientsTable
        clients={paginatedClients}
        filteredClientsCount={filteredClients.length}
        isLoading={isClientsLoading}
        selectedClientId={selectedClientId}
        statsByClient={statsByClient}
        onDeleteClient={onDeleteClient}
        onOpenClientCard={openClientCard}
      />
      <PaginationPanel
        totalItems={filteredClients.length}
        page={clientsPage}
        pageSize={clientsPageSize}
        onPageChange={setClientsPage}
        onPageSizeChange={(nextPageSize) => {
          setClientsPageSize(nextPageSize);
          setClientsPage(1);
        }}
      />

      {isCreateModalOpen ? (
        <ClientCreateModal
          form={personForm}
          isSaving={isSaving}
          onChange={setPersonForm}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={() => {
            void handleCreateClient();
          }}
        />
      ) : null}

      {isMergeModalOpen ? (
        <ClientMergeModal
          isSaving={isSaving}
          sourceId={mergeSourceId}
          sourceOptions={mergeSourceOptions}
          sourceQuery={mergeSourceQuery}
          targetId={mergeTargetId}
          targetOptions={mergeTargetOptions}
          targetQuery={mergeTargetQuery}
          showSourceSuggestions={showMergeSourceSuggestions}
          showTargetSuggestions={showMergeTargetSuggestions}
          onClose={() => setIsMergeModalOpen(false)}
          onMerge={() => {
            void handleMergeClients();
          }}
          onQueryChange={handleMergeQueryChange}
          onSelectClient={handleMergeClientSelect}
        />
      ) : null}

      {isClientCardOpen ? (
        <ClientCardModal
          activeHistoryRows={activeHistoryRows}
          clientCardTab={clientCardTab}
          historyClient={history?.client ?? null}
          isHistoryLoading={isHistoryLoading}
          isSaving={isSaving}
          clientVisitCount={
            statsByClient.get(selectedClientId ?? '')?.visits
            ?? selectedHistorySales.length
          }
          clientTotalRevenue={selectedHistorySales.reduce(
            (sum, sale) => sum + getClientSaleIncome(sale),
            0,
          )}
          mainTabForm={mainTabForm}
          mainTabPhoneError={mainTabPhoneError}
          selectedClient={selectedClient}
          selectedClientId={selectedClientId}
          onClearPhoneError={() => setMainTabPhoneError(null)}
          onClose={closeClientCard}
          onMainTabFormChange={handleMainTabFormChange}
          onOpenSaleCard={openSaleCardFromClientModal}
          onSaveMainTab={() => {
            void handleMainTabSave();
          }}
          onTabChange={setClientCardTab}
          onValidatePhone={validatePhone}
          clientDevices={clientDevices}
          onUpdateClientDevice={onUpdateClientDevice}
          onDeleteClientDevice={onDeleteClientDevice}
        />
      ) : null}
    </section>
  );
};






