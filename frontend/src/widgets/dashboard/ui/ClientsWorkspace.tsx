import { useEffect, useMemo, useState } from 'react';
import type {
  Client,
  ClientFormValues,
  ClientHistory,
  ClientStatus,
} from '../../../entities/client/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { formatCurrency, formatDateTime } from '../../../shared/lib/format';

type ClientsWorkspaceProps = {
  clients: Client[];
  sales: Sale[];
  selectedClientId: string | null;
  history: ClientHistory | null;
  isClientsLoading: boolean;
  isHistoryLoading: boolean;
  isSaving: boolean;
  onSelectClient: (clientId: string | null) => void;
  onDeleteClient: (client: Client) => Promise<void>;
  onCreateClient: (payload: ClientFormValues) => Promise<boolean>;
  onMergeClients: (
    targetClientId: string,
    sourceClientId: string,
  ) => Promise<boolean>;
  onUpdateClient: (
    clientId: string,
    payload: ClientFormValues,
  ) => Promise<boolean>;
  onOpenSaleCard: (sale: Sale) => void;
};

type ClientFilters = {
  query: string;
  clientId: string;
  orderNumber: string;
  dateFrom: string;
  dateTo: string;
  visitsFrom: string;
  visitsTo: string;
  incomeFrom: string;
  incomeTo: string;
  operatorId: string;
};

type ClientCardTab = 'main' | 'services' | 'sales';
type CreateClientTab = 'person' | 'company';

type ClientStats = {
  visits: number;
  income: number;
  serviceCount: number;
  salesCount: number;
  operatorIds: string[];
  orderNumbers: string[];
};

const emptyFilters: ClientFilters = {
  query: '',
  clientId: '',
  orderNumber: '',
  dateFrom: '',
  dateTo: '',
  visitsFrom: '',
  visitsTo: '',
  incomeFrom: '',
  incomeTo: '',
  operatorId: '',
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const parseNumber = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const getDateStart = (value: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const getDateEnd = (value: string) => {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const getClientSubtitle = (client: Client) =>
  `${client.name} (${client.phone})`;

const defaultClientStats: ClientStats = {
  visits: 0,
  income: 0,
  serviceCount: 0,
  salesCount: 0,
  operatorIds: [],
  orderNumbers: [],
};

const formatClientIncome = (value: number) =>
  `${formatCurrency(value).replace(/[^\d,\s.-]/g, '').trim()} грн`;

const clientStatusOptions: Array<{
  label: string;
  value: ClientStatus | '';
}> = [
  { label: '—', value: '' },
  { label: 'new', value: 'new' },
  { label: 'Чорний список', value: 'blacklist' },
  { label: 'VIP', value: 'vip' },
  { label: 'Знижка', value: 'opt' },
  { label: 'Регулярний', value: 'ok' },
];

const getMetaFieldFromNote = (
  note: string,
  key: 'Address' | 'Email',
) => {
  const prefix = `${key}:`;
  const line = note.split('\n').find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
};

const getMetaFieldFromNoteLegacy = (
  note: string,
  key: 'Адреса' | 'Електронна пошта',
) => {
  const prefix = `${key}:`;
  const line = note.split('\n').find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
};

const getPlainNote = (note: string) =>
  note
    .split('\n')
    .filter(
      (line) =>
        !line.startsWith('Address:') &&
        !line.startsWith('Email:') &&
        !line.startsWith('Адреса:') &&
        !line.startsWith('Електронна пошта:'),
    )
    .join('\n')
    .trim();

const formatItemList = (sale: Sale, tab: ClientCardTab) => {
  const targetKind = tab === 'services' ? 'service' : 'product';
  const lineItems = (sale.lineItems ?? []).filter(
    (item) => item.kind === targetKind,
  );

  if (lineItems.length > 0) {
    return lineItems
      .map((item) => `${item.name} x${item.quantity}`)
      .join(', ');
  }

  return sale.product.name;
};

const getClientStatsMap = (sales: Sale[]) => {
  const map = new Map<string, ClientStats>();

  sales.forEach((sale) => {
    const current = map.get(sale.client.id) ?? { ...defaultClientStats };
    const income = sale.salePrice * sale.quantity;
    const orderNumbers = sale.recordNumber
      ? [...current.orderNumbers, sale.recordNumber]
      : current.orderNumbers;
    const operatorId = sale.manager?.id ?? '';
    const operatorIds = operatorId
      ? [...current.operatorIds, operatorId]
      : current.operatorIds;

    map.set(sale.client.id, {
      visits: current.visits + 1,
      income: current.income + income,
      serviceCount: current.serviceCount + (sale.kind === 'repair' ? 1 : 0),
      salesCount: current.salesCount + (sale.kind === 'sale' ? 1 : 0),
      orderNumbers,
      operatorIds,
    });
  });

  return map;
};

const getOperatorOptions = (sales: Sale[]) => {
  const unique = new Map<string, string>();

  sales.forEach((sale) => {
    if (!sale.manager?.id) return;
    unique.set(sale.manager.id, sale.manager.name || sale.manager.id);
  });

  return [...unique.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const mapClientToCreatePayload = (
  tab: CreateClientTab,
  personForm: {
    phone: string;
    name: string;
    address: string;
    email: string;
    note: string;
  },
  companyForm: {
    organizationName: string;
    phone: string;
    registration1: string;
    registration2: string;
    legalAddress: string;
    factualAddress: string;
    email: string;
    note: string;
  },
): ClientFormValues => {
  if (tab === 'person') {
    const noteParts = [
      personForm.note,
      personForm.address && `Адреса: ${personForm.address}`,
      personForm.email && `Електронна пошта: ${personForm.email}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      phone: personForm.phone.trim(),
      name: personForm.name.trim(),
      note: noteParts,
      status: 'new',
    };
  }

  const noteParts = [
    companyForm.note,
    companyForm.registration1 &&
      `Реєстраційні дані 1: ${companyForm.registration1}`,
    companyForm.registration2 &&
      `Реєстраційні дані 2: ${companyForm.registration2}`,
    companyForm.legalAddress &&
      `Юридична адреса: ${companyForm.legalAddress}`,
    companyForm.factualAddress &&
      `Фактична адреса: ${companyForm.factualAddress}`,
    companyForm.email && `Електронна пошта: ${companyForm.email}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    phone: companyForm.phone.trim(),
    name: companyForm.organizationName.trim(),
    note: noteParts,
    status: 'new',
  };
};

export const ClientsWorkspace = ({
  clients,
  sales,
  selectedClientId,
  history,
  isClientsLoading,
  isHistoryLoading,
  isSaving,
  onSelectClient,
  onDeleteClient,
  onCreateClient,
  onMergeClients,
  onUpdateClient,
  onOpenSaleCard,
}: ClientsWorkspaceProps) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] =
    useState<ClientFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<ClientFilters>(emptyFilters);
  const [searchValue, setSearchValue] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isClientCardOpen, setIsClientCardOpen] = useState(false);
  const [clientCardTab, setClientCardTab] =
    useState<ClientCardTab>('main');
  const [createClientTab, setCreateClientTab] =
    useState<CreateClientTab>('person');
  const [personForm, setPersonForm] = useState({
    phone: '+380',
    name: '',
    address: '',
    email: '',
    note: '',
  });
  const [companyForm, setCompanyForm] = useState({
    organizationName: '',
    phone: '+380',
    registration1: '',
    registration2: '',
    legalAddress: '',
    factualAddress: '',
    email: '',
    note: '',
  });
  const [mergeTargetQuery, setMergeTargetQuery] = useState('');
  const [mergeSourceQuery, setMergeSourceQuery] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mainTabForm, setMainTabForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    note: '',
    status: '' as ClientStatus | '',
  });

  const statsByClient = useMemo(() => getClientStatsMap(sales), [sales]);
  const operatorOptions = useMemo(() => getOperatorOptions(sales), [sales]);

  const activeFiltersCount = useMemo(
    () =>
      (appliedFilters.query ? 1 : 0) +
      (appliedFilters.clientId ? 1 : 0) +
      (appliedFilters.orderNumber ? 1 : 0) +
      (appliedFilters.dateFrom ? 1 : 0) +
      (appliedFilters.dateTo ? 1 : 0) +
      (appliedFilters.visitsFrom ? 1 : 0) +
      (appliedFilters.visitsTo ? 1 : 0) +
      (appliedFilters.incomeFrom ? 1 : 0) +
      (appliedFilters.incomeTo ? 1 : 0) +
      (appliedFilters.operatorId ? 1 : 0),
    [appliedFilters],
  );

  const filteredClients = useMemo(() => {
    const query = normalizeText(appliedFilters.query);
    const byOrder = normalizeText(appliedFilters.orderNumber);
    const dateFrom = getDateStart(appliedFilters.dateFrom);
    const dateTo = getDateEnd(appliedFilters.dateTo);
    const visitsFrom = parseNumber(appliedFilters.visitsFrom);
    const visitsTo = parseNumber(appliedFilters.visitsTo);
    const incomeFrom = parseNumber(appliedFilters.incomeFrom);
    const incomeTo = parseNumber(appliedFilters.incomeTo);

    return [...clients]
      .filter((client) => {
        const stats = statsByClient.get(client.id) ?? defaultClientStats;
        const searchable =
          `${client.id} ${client.name} ${client.phone} ${client.note}`.toLowerCase();
        const createdAt = new Date(client.createdAt).getTime();

        if (query && !searchable.includes(query)) return false;
        if (
          appliedFilters.clientId &&
          !client.id
            .toLowerCase()
            .includes(appliedFilters.clientId.trim().toLowerCase())
        ) {
          return false;
        }
        if (
          byOrder &&
          !stats.orderNumbers.some((number) =>
            number.toLowerCase().includes(byOrder),
          )
        ) {
          return false;
        }
        if (dateFrom !== null && createdAt < dateFrom) return false;
        if (dateTo !== null && createdAt > dateTo) return false;
        if (visitsFrom !== null && stats.visits < visitsFrom) return false;
        if (visitsTo !== null && stats.visits > visitsTo) return false;
        if (incomeFrom !== null && stats.income < incomeFrom) return false;
        if (incomeTo !== null && stats.income > incomeTo) return false;
        if (
          appliedFilters.operatorId &&
          !stats.operatorIds.includes(appliedFilters.operatorId)
        )
          return false;

        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [appliedFilters, clients, statsByClient]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  useEffect(() => {
    if (!selectedClient) return;

    setMainTabForm({
      name: selectedClient.name,
      phone: selectedClient.phone,
      email:
        getMetaFieldFromNote(selectedClient.note, 'Email') ||
        getMetaFieldFromNoteLegacy(
          selectedClient.note,
          'Електронна пошта',
        ),
      address:
        getMetaFieldFromNote(selectedClient.note, 'Address') ||
        getMetaFieldFromNoteLegacy(selectedClient.note, 'Адреса'),
      note: getPlainNote(selectedClient.note),
      status: selectedClient.status || '',
    });
  }, [selectedClient]);

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

  const applyFilters = () => {
    const next = {
      ...draftFilters,
      query: draftFilters.query.trim(),
      clientId: draftFilters.clientId.trim(),
      orderNumber: draftFilters.orderNumber.trim(),
      visitsFrom: draftFilters.visitsFrom.trim(),
      visitsTo: draftFilters.visitsTo.trim(),
      incomeFrom: draftFilters.incomeFrom.trim(),
      incomeTo: draftFilters.incomeTo.trim(),
    };

    setDraftFilters(next);
    setAppliedFilters(next);
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const submitSearch = () => {
    const nextQuery = searchValue.trim();
    setDraftFilters((current) => ({ ...current, query: nextQuery }));
    setAppliedFilters((current) => ({ ...current, query: nextQuery }));
  };

  const openClientCard = (clientId: string) => {
    onSelectClient(clientId);
    setClientCardTab('main');
    setIsClientCardOpen(true);
  };

  const closeClientCard = () => {
    setIsClientCardOpen(false);
    onSelectClient(null);
  };

  const handleCreateClient = async () => {
    const payload = mapClientToCreatePayload(
      createClientTab,
      personForm,
      companyForm,
    );
    if (!payload.phone || !payload.name) return;

    const isSuccess = await onCreateClient(payload);
    if (!isSuccess) return;

    setIsCreateModalOpen(false);
    setCreateClientTab('person');
    setPersonForm({
      phone: '+380',
      name: '',
      address: '',
      email: '',
      note: '',
    });
    setCompanyForm({
      organizationName: '',
      phone: '+380',
      registration1: '',
      registration2: '',
      legalAddress: '',
      factualAddress: '',
      email: '',
      note: '',
    });
  };

  const handleMergeClients = async () => {
    if (
      !mergeTargetId ||
      !mergeSourceId ||
      mergeTargetId === mergeSourceId
    )
      return;

    const isSuccess = await onMergeClients(mergeTargetId, mergeSourceId);
    if (!isSuccess) return;

    setIsMergeModalOpen(false);
    setMergeTargetQuery('');
    setMergeSourceQuery('');
    setMergeTargetId('');
    setMergeSourceId('');
  };

  const handleMainTabSave = async () => {
    if (!selectedClientId) return;

    const noteParts = [
      mainTabForm.note.trim(),
      mainTabForm.address.trim()
        ? `Адреса: ${mainTabForm.address.trim()}`
        : '',
      mainTabForm.email.trim()
        ? `Електронна пошта: ${mainTabForm.email.trim()}`
        : '',
    ].filter(Boolean);

    await onUpdateClient(selectedClientId, {
      name: mainTabForm.name.trim(),
      phone: mainTabForm.phone.trim(),
      note: noteParts.join('\n'),
      status: (mainTabForm.status || 'new') as ClientStatus,
    });
  };

  const openSaleCardFromClientModal = (sale: Sale) => {
    closeClientCard();
    onOpenSaleCard(sale);
  };

  return (
    <section className='panel clients-workspace'>
      <div className='orders-toolbar clients-toolbar'>
        <div className='orders-toolbar-left'>
          <button
            type='button'
            className='toolbar-filter-button toolbar-filter-toggle-button'
            aria-expanded={isFilterOpen}
            onClick={() => setIsFilterOpen((current) => !current)}
          >
            Фільтр
            {activeFiltersCount > 0 ? (
              <span className='toolbar-filter-count'>
                {activeFiltersCount}
              </span>
            ) : null}
          </button>
          <div className='orders-search-group clients-search-group'>
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder='Пошук за імʼям або телефоном'
              aria-label='Пошук клієнта'
            />
            <button type='button' onClick={submitSearch}>
              Знайти
            </button>
          </div>
        </div>
        <div className='orders-toolbar-actions clients-toolbar-actions'>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => setIsMergeModalOpen(true)}
          >
            Обʼєднати
          </button>
          <button
            type='button'
            className='orders-create-button'
            onClick={() => setIsCreateModalOpen(true)}
          >
            Створити клієнта
          </button>
        </div>
      </div>

      <section
        className={
          isFilterOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
      >
        <div className='orders-filter-grid'>
          <label className='orders-filter-field'>
            <span>Телефон / ПІБ</span>
            <input
              type='text'
              value={draftFilters.query}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  query: event.target.value,
                }))
              }
              placeholder='+380..., Іван'
            />
          </label>
          <label className='orders-filter-field'>
            <span>ID клієнта</span>
            <input
              type='text'
              value={draftFilters.clientId}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  clientId: event.target.value,
                }))
              }
              placeholder='ID'
            />
          </label>
          <label className='orders-filter-field'>
            <span>№ замовлення</span>
            <input
              type='text'
              value={draftFilters.orderNumber}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  orderNumber: event.target.value,
                }))
              }
              placeholder='r000001'
            />
          </label>
          <label className='orders-filter-field'>
            <span>Дата від</span>
            <input
              type='date'
              value={draftFilters.dateFrom}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </label>
          <label className='orders-filter-field'>
            <span>Дата до</span>
            <input
              type='date'
              value={draftFilters.dateTo}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </label>
          <label className='orders-filter-field'>
            <span>Оператор</span>
            <select
              value={draftFilters.operatorId}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  operatorId: event.target.value,
                }))
              }
            >
              <option value=''>Будь-який</option>
              {operatorOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>Кількість звернень від</span>
            <input
              type='number'
              min='0'
              value={draftFilters.visitsFrom}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  visitsFrom: event.target.value,
                }))
              }
              placeholder='0'
            />
          </label>
          <label className='orders-filter-field'>
            <span>Кількість звернень до</span>
            <input
              type='number'
              min='0'
              value={draftFilters.visitsTo}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  visitsTo: event.target.value,
                }))
              }
              placeholder='0'
            />
          </label>
          <label className='orders-filter-field'>
            <span>Дохід від клієнта від</span>
            <input
              type='number'
              min='0'
              value={draftFilters.incomeFrom}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  incomeFrom: event.target.value,
                }))
              }
              placeholder='0'
            />
          </label>
          <label className='orders-filter-field'>
            <span>Дохід від клієнта до</span>
            <input
              type='number'
              min='0'
              value={draftFilters.incomeTo}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  incomeTo: event.target.value,
                }))
              }
              placeholder='0'
            />
          </label>
        </div>
        <div className='orders-filter-actions'>
          <button
            type='button'
            className='toolbar-filter-button orders-filter-apply'
            onClick={applyFilters}
          >
            Застосувати
          </button>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={clearFilters}
          >
            Очистити фільтр
          </button>
        </div>
      </section>

      <div className='orders-table-wrap'>
        <table className='orders-table clients-table'>
          <thead>
            <tr>
              <th>Id</th>
              <th>Тег</th>
              <th>ПІБ</th>
              <th>Телефон</th>
              <th>Дата реєстрації</th>
              <th>Кількість звернень</th>
              <th>Дохід від клієнта</th>
              <th aria-label='actions' />
            </tr>
          </thead>
          <tbody>
            {isClientsLoading ? (
              <tr>
                <td colSpan={8} className='orders-empty'>
                  Завантаження клієнтів...
                </td>
              </tr>
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={8} className='orders-empty'>
                  Клієнтів за заданими фільтрами не знайдено.
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const stats =
                  statsByClient.get(client.id) ?? defaultClientStats;
                const isActive = selectedClientId === client.id;

                return (
                  <tr
                    key={client.id}
                    className={
                      isActive
                        ? 'clients-table-row clients-table-row-active'
                        : 'clients-table-row'
                    }
                    onClick={() => openClientCard(client.id)}
                  >
                    <td>{client.id.slice(-6)}</td>
                    <td>{client.status}</td>
                    <td>{client.name}</td>
                    <td>
                      <a
                        href={`tel:${client.phone}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {client.phone}
                      </a>
                    </td>
                    <td>{formatDateTime(client.createdAt)}</td>
                    <td>{stats.visits}</td>
                    <td>{formatClientIncome(stats.income)}</td>
                    <td>
                      <button
                        type='button'
                        className='clients-delete-button'
                        disabled={stats.visits > 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void onDeleteClient(client);
                        }}
                        aria-label={`Видалити ${client.name}`}
                        title={
                          stats.visits > 0
                            ? 'Неможливо видалити клієнта із замовленнями або продажами.'
                            : 'Видалити клієнта'
                        }
                      >
                        x
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isCreateModalOpen ? (
        <div
          className='modal-backdrop'
          role='presentation'
          onClick={() => setIsCreateModalOpen(false)}
        >
          <article
            className='catalog-edit-modal clients-modal'
            role='dialog'
            aria-modal='true'
            onClick={(event) => event.stopPropagation()}
          >
            <header className='catalog-edit-header'>
              <h2>Додати клієнта</h2>
              <button
                type='button'
                className='ghost-button'
                onClick={() => setIsCreateModalOpen(false)}
              >
                x
              </button>
            </header>
            <div className='clients-modal-tabs'>
              <button
                type='button'
                className={
                  createClientTab === 'person'
                    ? 'catalog-tab catalog-tab-active'
                    : 'catalog-tab'
                }
                onClick={() => setCreateClientTab('person')}
              >
                Фіз. ос.
              </button>
              <button
                type='button'
                className={
                  createClientTab === 'company'
                    ? 'catalog-tab catalog-tab-active'
                    : 'catalog-tab'
                }
                onClick={() => setCreateClientTab('company')}
              >
                Юр. ос.
              </button>
            </div>
            <div className='catalog-edit-body clients-modal-body'>
              {createClientTab === 'person' ? (
                <div className='form-grid compact-form-grid'>
                  <label className='field field-wide'>
                    <span>Телефон</span>
                    <input
                      value={personForm.phone}
                      onChange={(event) =>
                        setPersonForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>ПІБ</span>
                    <input
                      value={personForm.name}
                      onChange={(event) =>
                        setPersonForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Адреса</span>
                    <input
                      value={personForm.address}
                      onChange={(event) =>
                        setPersonForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Електронна пошта</span>
                    <input
                      value={personForm.email}
                      onChange={(event) =>
                        setPersonForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Примітка</span>
                    <textarea
                      rows={4}
                      value={personForm.note}
                      onChange={(event) =>
                        setPersonForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              ) : (
                <div className='form-grid compact-form-grid'>
                  <label className='field field-wide'>
                    <span>Назва організації</span>
                    <input
                      value={companyForm.organizationName}
                      onChange={(event) =>
                        setCompanyForm((current) => ({
                          ...current,
                          organizationName: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Телефон</span>
                    <input
                      value={companyForm.phone}
                      onChange={(event) =>
                        setCompanyForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Реєстраційні дані 1</span>
                    <input
                      value={companyForm.registration1}
                      onChange={(event) =>
                        setCompanyForm((current) => ({
                          ...current,
                          registration1: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Реєстраційні дані 2</span>
                    <input
                      value={companyForm.registration2}
                      onChange={(event) =>
                        setCompanyForm((current) => ({
                          ...current,
                          registration2: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Юридична адреса</span>
                    <input
                      value={companyForm.legalAddress}
                      onChange={(event) =>
                        setCompanyForm((current) => ({
                          ...current,
                          legalAddress: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Фактична адреса</span>
                    <input
                      value={companyForm.factualAddress}
                      onChange={(event) =>
                        setCompanyForm((current) => ({
                          ...current,
                          factualAddress: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Електронна пошта</span>
                    <input
                      value={companyForm.email}
                      onChange={(event) =>
                        setCompanyForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Примітка</span>
                    <textarea
                      rows={4}
                      value={companyForm.note}
                      onChange={(event) =>
                        setCompanyForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              )}
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={isSaving}
                onClick={() => {
                  void handleCreateClient();
                }}
              >
                {isSaving ? 'Збереження...' : 'Додати'}
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {isMergeModalOpen ? (
        <div
          className='modal-backdrop'
          role='presentation'
          onClick={() => setIsMergeModalOpen(false)}
        >
          <article
            className='catalog-edit-modal clients-modal'
            role='dialog'
            aria-modal='true'
            onClick={(event) => event.stopPropagation()}
          >
            <header className='catalog-edit-header'>
              <h2>Обʼєднати клієнтів</h2>
              <button
                type='button'
                className='ghost-button'
                onClick={() => setIsMergeModalOpen(false)}
              >
                x
              </button>
            </header>
            <div className='catalog-edit-body clients-modal-body'>
              <p className='muted-copy'>
                Виберіть клієнта 1 та клієнта 2. Дані з клієнта 2
                будуть обʼєднані в клієнта 1, після чого клієнта 2 буде видалено.
              </p>
              <label className='field field-wide'>
                <span>Клієнт 1</span>
                <input
                  value={mergeTargetQuery}
                  placeholder='Введіть ПІБ або телефон'
                  onChange={(event) => {
                    setMergeTargetQuery(event.target.value);
                    setMergeTargetId('');
                  }}
                />
              </label>
              {mergeTargetOptions.length > 0 ? (
                <div className='suggestions-panel'>
                  {mergeTargetOptions.map((client) => (
                    <button
                      key={client.id}
                      type='button'
                      className='suggestion-item'
                      onClick={() => {
                        setMergeTargetId(client.id);
                        setMergeTargetQuery(getClientSubtitle(client));
                      }}
                    >
                      <strong>{client.name}</strong>
                      <span>{client.phone}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <label className='field field-wide'>
                <span>Клієнт 2</span>
                <input
                  value={mergeSourceQuery}
                  placeholder='Введіть ПІБ або телефон'
                  onChange={(event) => {
                    setMergeSourceQuery(event.target.value);
                    setMergeSourceId('');
                  }}
                />
              </label>
              {mergeSourceOptions.length > 0 ? (
                <div className='suggestions-panel'>
                  {mergeSourceOptions.map((client) => (
                    <button
                      key={client.id}
                      type='button'
                      className='suggestion-item'
                      onClick={() => {
                        setMergeSourceId(client.id);
                        setMergeSourceQuery(getClientSubtitle(client));
                      }}
                    >
                      <strong>{client.name}</strong>
                      <span>{client.phone}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={
                  isSaving ||
                  !mergeTargetId ||
                  !mergeSourceId ||
                  mergeTargetId === mergeSourceId
                }
                onClick={() => {
                  void handleMergeClients();
                }}
              >
                {isSaving ? 'Обʼєднання...' : 'Обʼєднати клієнтів'}
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {isClientCardOpen ? (
        <div
          className='modal-backdrop'
          role='presentation'
          onClick={closeClientCard}
        >
          <article
            className='clients-card-modal'
            role='dialog'
            aria-modal='true'
            onClick={(event) => event.stopPropagation()}
          >
            <header className='clients-card-header'>
              <div>
                <p className='section-label'>Клієнт</p>
                <h2>
                  {selectedClient?.name ??
                    history?.client.name ??
                    'Картка клієнта'}
                </h2>
                <p className='panel-subtitle'>
                  {selectedClient?.phone ?? history?.client.phone ?? ''}
                </p>
              </div>
              <button
                type='button'
                className='ghost-button'
                onClick={closeClientCard}
              >
                x
              </button>
            </header>

            <div
              className='orders-tabs clients-card-tabs'
              role='tablist'
              aria-label='Картка клієнта'
            >
              <button
                type='button'
                className={
                  clientCardTab === 'main'
                    ? 'orders-tab orders-tab-active'
                    : 'orders-tab'
                }
                onClick={() => setClientCardTab('main')}
              >
                Основні
              </button>
              <button
                type='button'
                className={
                  clientCardTab === 'services'
                    ? 'orders-tab orders-tab-active'
                    : 'orders-tab'
                }
                onClick={() => setClientCardTab('services')}
              >
                Послуги
              </button>
              <button
                type='button'
                className={
                  clientCardTab === 'sales'
                    ? 'orders-tab orders-tab-active'
                    : 'orders-tab'
                }
                onClick={() => setClientCardTab('sales')}
              >
                Продажі
              </button>
            </div>

            <div className='clients-card-body'>
              {isHistoryLoading && clientCardTab !== 'main' ? (
                <p className='empty-state'>Завантаження історії клієнта...</p>
              ) : !selectedClientId ? (
                <p className='empty-state'>
                  Оберіть клієнта зі списку.
                </p>
              ) : clientCardTab === 'main' ? (
                <div className='form-grid compact-form-grid'>
                  <label className='field field-wide'>
                    <span>ПІБ</span>
                    <input
                      value={mainTabForm.name}
                      onChange={(event) =>
                        setMainTabForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Електронна пошта</span>
                    <input
                      value={mainTabForm.email}
                      onChange={(event) =>
                        setMainTabForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Адреса</span>
                    <input
                      value={mainTabForm.address}
                      onChange={(event) =>
                        setMainTabForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Телефон</span>
                    <input
                      value={mainTabForm.phone}
                      onChange={(event) =>
                        setMainTabForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className='field field-wide'>
                    <span>Статус</span>
                    <select
                      value={mainTabForm.status}
                      onChange={(event) =>
                        setMainTabForm((current) => ({
                          ...current,
                          status: event.target.value as ClientStatus | '',
                        }))
                      }
                    >
                      {clientStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className='field field-wide'>
                    <span>Примітка</span>
                    <textarea
                      rows={4}
                      value={mainTabForm.note}
                      onChange={(event) =>
                        setMainTabForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className='field field-wide'>
                    <button
                      type='button'
                      className='primary-button clients-main-save'
                      disabled={
                        isSaving ||
                        !mainTabForm.name.trim() ||
                        !mainTabForm.phone.trim()
                      }
                      onClick={() => {
                        void handleMainTabSave();
                      }}
                    >
                      {isSaving ? 'Збереження...' : 'Зберегти клієнта'}
                    </button>
                  </div>
                </div>
              ) : activeHistoryRows.length === 0 ? (
                <p className='empty-state'>
                  {clientCardTab === 'services'
                    ? 'Для цього клієнта не знайдено послуг.'
                    : 'Для цього клієнта не знайдено продажів.'}
                </p>
              ) : (
                <div className='orders-table-wrap'>
                  <table className='orders-table clients-card-table'>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Дата</th>
                        <th>
                          {clientCardTab === 'services'
                            ? 'Послуга'
                            : 'Продаж'}
                        </th>
                        <th>Статус</th>
                        <th>Сума</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeHistoryRows.map((sale) => (
                        <tr
                          key={sale.id}
                          className='clients-history-row'
                          onClick={() => openSaleCardFromClientModal(sale)}
                        >
                          <td>
                            <button
                              type='button'
                              className='order-number-button'
                              onClick={(event) => {
                                event.stopPropagation();
                                openSaleCardFromClientModal(sale);
                              }}
                            >
                              {sale.recordNumber ?? sale.id.slice(-6)}
                            </button>
                          </td>
                          <td>{formatDateTime(sale.saleDate)}</td>
                          <td>{formatItemList(sale, clientCardTab)}</td>
                          <td>{sale.status}</td>
                          <td>
                            {formatClientIncome(
                              sale.salePrice * sale.quantity,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
};
