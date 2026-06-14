import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import type {
  Client,
  ClientFormValues,
  ClientHistory,
  ClientStatus,
} from '../../../entities/client/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  isValidUkrainianPhone,
  normalizePhone,
} from '../../../shared/lib/phoneFormatter';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';
import { ClientCardModal } from './ClientCardModal';
import { ClientCreateModal } from './ClientCreateModal';
import { ClientMergeModal, type ClientMergeField } from './ClientMergeModal';
import { ClientsFilterPanel } from './ClientsFilterPanel';
import { ClientsTable } from './ClientsTable';
import { ClientsToolbar } from './ClientsToolbar';
import {
  clientCardTabStorageKey,
  clientsFiltersStorageKey,
  defaultClientStats,
  emptyClientDraft,
  emptyFilters,
  getActiveClientFiltersCount,
  getClientSubtitle,
  getFilteredClients,
  getStoredClientCardTab,
  isOptionalAddressValid,
  isOptionalIbanValid,
  isOptionalRegistrationIdValid,
  normalizeClientFiltersForApply,
  normalizeIban,
  normalizeText,
  type ClientCardTab,
  type ClientFilters,
  type ClientMainForm,
  type ClientStats,
} from '../model/clients-workspace';

type ClientsWorkspaceProps = {
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
};

const MAX_PHONE_LENGTH = 10;
const clientStatusOptions: Array<{
  label: string;
  value: ClientStatus | '';
}> = [
  { label: '-', value: '' },
  { label: 'new', value: 'new' },
  { label: 'blacklist', value: 'blacklist' },
  { label: 'VIP', value: 'vip' },
  { label: 'discount', value: 'opt' },
  { label: 'regular', value: 'ok' },
];

const filterStatusOptions: Array<{
  label: string;
  value: ClientStatus | '' | 'all';
}> = [{ label: 'All', value: 'all' }, ...clientStatusOptions];

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

const getClientStatsMap = (sales: Sale[]) => {
  const map = new Map<string, ClientStats>();

  sales.forEach((sale) => {
    const current = map.get(sale.client.id) ?? {
      ...defaultClientStats,
    };
    const income = sale.salePrice * sale.quantity;
    const orderNumbers = sale.recordNumber
      ? [...current.orderNumbers, sale.recordNumber]
      : current.orderNumbers;

    map.set(sale.client.id, {
      visits: current.visits + 1,
      income: current.income + income,
      serviceCount:
        current.serviceCount + (sale.kind === 'repair' ? 1 : 0),
      salesCount: current.salesCount + (sale.kind === 'sale' ? 1 : 0),
      orderNumbers,
    });
  });

  return map;
};

const mapClientDraftToPayload = (
  draft: typeof emptyClientDraft,
  status: ClientStatus | '' = 'new',
): ClientFormValues => ({
  phone: draft.phone.trim(),
  name: draft.name.trim(),
  email: draft.email.trim(),
  address: draft.address.trim(),
  registrationId: draft.registrationId.trim(),
  iban: normalizeIban(draft.iban),
  note: draft.note.trim(),
  status,
});

export const ClientsWorkspace = ({
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
}: ClientsWorkspaceProps) => {
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

  const statsByClient = useMemo(
    () => getClientStatsMap(sales),
    [sales],
  );

  const activeFiltersCount = useMemo(
    () => getActiveClientFiltersCount(appliedFilters),
    [appliedFilters],
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
    if (!selectedClient) return;

    setMainTabForm({
      name: selectedClient.name,
      phone: selectedClient.phone,
      email: getLegacyClientEmail(selectedClient),
      address: getLegacyClientAddress(selectedClient),
      registrationId: selectedClient.registrationId,
      iban: selectedClient.iban,
      note: getPlainNote(selectedClient.note),
      status: selectedClient.status || '',
    });
  }, [selectedClient]);

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
    const query = normalizeText(mergeTargetQuery);
    if (!query) return [];

    return clients
      .filter((client) =>
        getClientSubtitle(client).toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [clients, mergeTargetQuery]);

  const mergeSourceOptions = useMemo(() => {
    const query = normalizeText(mergeSourceQuery);
    if (!query) return [];

    return clients
      .filter((client) =>
        getClientSubtitle(client).toLowerCase().includes(query),
      )
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
  };

  const validatePhone = (phone: string): boolean => {
    const normalized = normalizePhone(phone);
    if (normalized.length === 0) {
      setMainTabPhoneError('Invalid phone number format');
      return false;
    }
    if (normalized.length > MAX_PHONE_LENGTH) {
      setMainTabPhoneError('Invalid phone number format');
      return false;
    }
    if (!isValidUkrainianPhone(phone)) {
      setMainTabPhoneError('Invalid phone number format');
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

    await onUpdateClient(selectedClientId, {
      name: mainTabForm.name.trim(),
      phone: mainTabForm.phone.trim(),
      email: mainTabForm.email.trim(),
      address: mainTabForm.address.trim(),
      registrationId: mainTabForm.registrationId.trim(),
      iban: normalizeIban(mainTabForm.iban),
      note: mainTabForm.note.trim(),
      status: mainTabForm.status as ClientStatus | '',
    });
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
        onApply={applyFilters}
        onChange={setDraftFilters}
        onClear={clearFilters}
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
          mainTabForm={mainTabForm}
          mainTabPhoneError={mainTabPhoneError}
          selectedClient={selectedClient}
          selectedClientId={selectedClientId}
          statusOptions={clientStatusOptions}
          onClearPhoneError={() => setMainTabPhoneError(null)}
          onClose={closeClientCard}
          onMainTabFormChange={setMainTabForm}
          onOpenSaleCard={openSaleCardFromClientModal}
          onSaveMainTab={() => {
            void handleMainTabSave();
          }}
          onTabChange={setClientCardTab}
          onValidatePhone={validatePhone}
        />
      ) : null}
    </section>
  );
};






