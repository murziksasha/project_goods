import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ClientDevice,
  ClientDeviceFormValues,
} from '../../../../entities/client-device/model/types';
import {
  filterActiveClientDevicesForClient,
  getUnbindClientDeviceAction,
  unbindClientDevice,
} from '../../../../entities/client-device/lib/unbind-client-device';
import type {
  Client,
  ClientStatus,
} from '../../../../entities/client/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import {
  clientStatusOptions,
  getClientStatusClass,
  getClientStatusColor,
  getClientStatusLabelKey,
  getEffectiveClientStatusLogic,
} from '../../../../entities/client/model/constants';
import { formatDateTime } from '../../../../shared/lib/format';
import {
  formatClientIncome,
  getClientSaleIncome,
  formatItemList,
  isOptionalAddressValid,
  isOptionalIbanValid,
  isOptionalRegistrationIdValid,
  type ClientCardTab,
  type ClientMainForm,
} from '../../model/clients-workspace';
import {
  CLIENT_CARD_PAGE_SIZE,
  collectHistoryStatuses,
  filterClientDeviceRows,
  filterClientHistoryRows,
  paginateItems,
  type ClientDeviceListFilters,
  type ClientHistoryListFilters,
} from '../../model/client-card-list';
import { isValidUkrainianPhone } from '../../../../shared/lib/phoneFormatter';
import { hasDuplicatePhones } from '../../../../shared/lib/phones';
import { PhonesField } from '../../../../shared/ui/PhonesField';
import { Modal } from '../../../../shared/ui/Modal';
import { CompactPaginationPanel } from '../../../../shared/ui/PaginationPanel';

type ClientCardModalProps = {
  activeHistoryRows: Sale[];
  historySales?: Sale[];
  clientCardTab: ClientCardTab;
  historyClient: Client | null;
  isHistoryLoading: boolean;
  isSaving: boolean;
  mainTabForm: ClientMainForm;
  mainTabPhoneError: string | null;
  selectedClient: Client | null;
  selectedClientId: string | null;
  clientVisitCount?: number;
  clientTotalRevenue?: number;
  onClose: () => void;
  onMainTabFormChange: Dispatch<SetStateAction<ClientMainForm>>;
  onOpenSaleCard: (sale: Sale) => void;
  onSaveMainTab: () => void;
  onTabChange: (tab: ClientCardTab) => void;
  onValidatePhone: (phone: string) => boolean;
  onClearPhoneError: () => void;
  clientDevices: ClientDevice[];
  onUpdateClientDevice: (
    deviceId: string,
    payload: ClientDeviceFormValues,
  ) => Promise<boolean>;
  onDeleteClientDevice: (deviceId: string) => Promise<boolean>;
};

const clientCardTabs: Array<{ key: ClientCardTab; labelKey: string }> = [
  { key: 'main', labelKey: 'clients.tabs.main' },
  { key: 'orders', labelKey: 'clients.tabs.orders' },
  { key: 'sales', labelKey: 'clients.tabs.sales' },
  { key: 'devices', labelKey: 'clients.tabs.devices' },
  { key: 'information', labelKey: 'clients.tabs.information' },
];

export const ClientCardModal = ({
  activeHistoryRows,
  historySales = [],
  clientCardTab,
  historyClient,
  isHistoryLoading,
  isSaving,
  mainTabForm,
  mainTabPhoneError,
  selectedClient,
  selectedClientId,
  clientVisitCount,
  clientTotalRevenue,
  onClose,
  onMainTabFormChange,
  onOpenSaleCard,
  onSaveMainTab,
  onTabChange,
  onValidatePhone,
  onClearPhoneError,
  clientDevices,
  onUpdateClientDevice,
  onDeleteClientDevice,
}: ClientCardModalProps) => {
  const { t } = useTranslation();
  const [unbindingDeviceId, setUnbindingDeviceId] = useState<string | null>(
    null,
  );
  const [listPage, setListPage] = useState(1);
  const [listQuery, setListQuery] = useState('');
  const [isListFilterOpen, setIsListFilterOpen] = useState(false);
  const [historyFilters, setHistoryFilters] =
    useState<ClientHistoryListFilters>({
      query: '',
      status: 'all',
      dateFrom: '',
      dateTo: '',
    });
  const [deviceFilters, setDeviceFilters] =
    useState<ClientDeviceListFilters>({
      query: '',
      activity: 'all',
    });

  useEffect(() => {
    setListPage(1);
    setListQuery('');
    setIsListFilterOpen(false);
    setHistoryFilters({
      query: '',
      status: 'all',
      dateFrom: '',
      dateTo: '',
    });
    setDeviceFilters({ query: '', activity: 'all' });
  }, [clientCardTab, selectedClientId]);

  const clientDeviceRows = useMemo(
    () =>
      selectedClientId
        ? filterActiveClientDevicesForClient(clientDevices, selectedClientId)
        : [],
    [clientDevices, selectedClientId],
  );

  const historyStatusOptions = useMemo(
    () => collectHistoryStatuses(activeHistoryRows),
    [activeHistoryRows],
  );

  const filteredHistoryRows = useMemo(
    () =>
      filterClientHistoryRows(
        activeHistoryRows,
        { ...historyFilters, query: listQuery },
        clientCardTab,
      ),
    [activeHistoryRows, historyFilters, listQuery, clientCardTab],
  );

  const filteredDeviceRows = useMemo(
    () =>
      filterClientDeviceRows(
        clientDeviceRows,
        { ...deviceFilters, query: listQuery },
        {
          active: t('catalog.modals.active'),
          inactive: t('catalog.modals.inactive'),
        },
      ),
    [clientDeviceRows, deviceFilters, listQuery, t],
  );

  const paginatedHistory = useMemo(
    () => paginateItems(filteredHistoryRows, listPage, CLIENT_CARD_PAGE_SIZE),
    [filteredHistoryRows, listPage],
  );

  const paginatedDevices = useMemo(
    () => paginateItems(filteredDeviceRows, listPage, CLIENT_CARD_PAGE_SIZE),
    [filteredDeviceRows, listPage],
  );

  const historyActiveFilterCount =
    (historyFilters.status !== 'all' ? 1 : 0) +
    (historyFilters.dateFrom ? 1 : 0) +
    (historyFilters.dateTo ? 1 : 0);
  const deviceActiveFilterCount =
    deviceFilters.activity !== 'all' ? 1 : 0;

  const handleListQueryChange = (value: string) => {
    setListQuery(value);
    setListPage(1);
  };

  const handleHistoryFilterChange = (
    patch: Partial<ClientHistoryListFilters>,
  ) => {
    setHistoryFilters((prev) => ({ ...prev, ...patch }));
    setListPage(1);
  };

  const handleDeviceFilterChange = (
    patch: Partial<ClientDeviceListFilters>,
  ) => {
    setDeviceFilters((prev) => ({ ...prev, ...patch }));
    setListPage(1);
  };
  const clientInfoStats = useMemo(() => {
    const stats = historySales.reduce(
      (accumulator, sale) => {
        const total = getClientSaleIncome(sale);
        if (sale.kind === 'repair') {
          accumulator.ordersCount += 1;
          accumulator.ordersAmount += total;
        } else {
          accumulator.salesCount += 1;
          accumulator.salesAmount += total;
        }
        return accumulator;
      },
      {
        ordersCount: 0,
        ordersAmount: 0,
        salesCount: 0,
        salesAmount: 0,
      },
    );
    const times = historySales
      .map((sale) => {
        const raw = sale.saleDate || sale.createdAt;
        const time = new Date(raw).getTime();
        return { value: raw, time };
      })
      .filter((item) => Number.isFinite(item.time));
    const firstContactAt =
      times.length > 0
        ? times.reduce((prev, curr) =>
            curr.time < prev.time ? curr : prev,
          ).value
        : null;
    const lastContactAt =
      times.length > 0
        ? times.reduce((prev, curr) =>
            curr.time > prev.time ? curr : prev,
          ).value
        : null;
    return {
      ...stats,
      totalCount: stats.ordersCount + stats.salesCount,
      totalAmount: stats.ordersAmount + stats.salesAmount,
      firstContactAt,
      lastContactAt,
    };
  }, [historySales]);
  const handleUnbindDevice = async (device: ClientDevice) => {
    if (!device.isActive || unbindingDeviceId) return;

    const action = getUnbindClientDeviceAction(device);
    const confirmMessage =
      action === 'delete'
        ? t('clients.card.devices.confirmDelete', { name: device.name })
        : t('clients.card.devices.confirmDeactivate', { name: device.name });

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setUnbindingDeviceId(device.id);
    try {
      await unbindClientDevice(device, {
        onDelete: onDeleteClientDevice,
        onUpdate: onUpdateClientDevice,
      });
    } finally {
      setUnbindingDeviceId(null);
    }
  };

  const updateForm = <K extends keyof ClientMainForm>(
    field: K,
    value: ClientMainForm[K],
  ) =>
    onMainTabFormChange((prev) => ({
      ...prev,
      [field]: value,
    }));

  const clientTitle =
    selectedClient?.name ??
    historyClient?.name ??
    t('clients.card.titleFallback');
  const clientPhone = selectedClient?.phone ?? historyClient?.phone ?? '';
  const visits = clientVisitCount ?? historySales.length;
  const stored = (selectedClient?.status ??
    historyClient?.status ??
    '') as ClientStatus | '';
  const effectiveStatus = getEffectiveClientStatusLogic(stored || '', visits);
  const needsHistory =
    clientCardTab === 'orders' ||
    clientCardTab === 'sales' ||
    clientCardTab === 'information';
  const isHistoryListTab =
    clientCardTab === 'orders' || clientCardTab === 'sales';
  const historyListTotal =
    clientTotalRevenue ??
    activeHistoryRows.reduce(
      (sum, sale) => sum + getClientSaleIncome(sale),
      0,
    );

  const tablist = (
    <div
      className="clients-card-tabs"
      role="tablist"
      aria-label={t('clients.card.tablistAriaLabel')}
    >
      {clientCardTabs.map((tab) => (
        <ClientCardTabButton
          key={tab.key}
          isActive={clientCardTab === tab.key}
          label={t(tab.labelKey)}
          onClick={() => onTabChange(tab.key)}
        />
      ))}
    </div>
  );

  return (
    <Modal
      isOpen
      title={clientTitle}
      subtitle={t('clients.card.sectionLabel')}
      onClose={onClose}
      closeLabel={t('common.close')}
      shellClassName="clients-card-modal modal-dialog"
      headerClassName="clients-card-header"
      bodyClassName="clients-card-body"
      headerExtra={tablist}
      headerActions={
        effectiveStatus ? (
          <span
            className={`client-status-badge ${getClientStatusClass(effectiveStatus)}`}
            style={{
              backgroundColor: getClientStatusColor(effectiveStatus),
              color: 'white',
              fontSize: '0.75rem',
              padding: '1px 6px',
            }}
          >
            {t(getClientStatusLabelKey(effectiveStatus))}
          </span>
        ) : null
      }
    >
      {clientPhone || isHistoryListTab ? (
        <div className="clients-card-meta-row">
          {clientPhone ? (
            <p className="panel-subtitle clients-card-phone">{clientPhone}</p>
          ) : (
            <span className="clients-card-phone" />
          )}
          {isHistoryListTab && selectedClientId && !isHistoryLoading ? (
            <p className="clients-card-total-inline">
              <span>{t('clients.card.totalForClient')}</span>
              <span aria-hidden="true"> — </span>
              <strong>{formatClientIncome(historyListTotal)}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {isHistoryLoading && needsHistory ? (
        <p className="empty-state">{t('clients.card.loadingHistory')}</p>
      ) : !selectedClientId ? (
        <p className="empty-state">{t('clients.card.selectClient')}</p>
      ) : clientCardTab === 'devices' ? (
        clientDeviceRows.length === 0 ? (
          <p className="empty-state">{t('clients.card.noDevices')}</p>
        ) : (
          <div className="clients-card-list">
            <ClientCardListToolbar
              totalItems={paginatedDevices.total}
              page={paginatedDevices.page}
              pageSize={CLIENT_CARD_PAGE_SIZE}
              query={listQuery}
              isFilterOpen={isListFilterOpen}
              activeFilterCount={deviceActiveFilterCount}
              searchPlaceholder={t('clients.card.searchPlaceholder.devices')}
              searchAriaLabel={t('clients.card.searchAriaLabel')}
              onPageChange={setListPage}
              onQueryChange={handleListQueryChange}
              onToggleFilter={() => setIsListFilterOpen((open) => !open)}
            />
            {isListFilterOpen ? (
              <ClientDeviceFiltersPanel
                filters={deviceFilters}
                onChange={handleDeviceFilterChange}
              />
            ) : null}
            {paginatedDevices.total === 0 ? (
              <p className="empty-state">{t('clients.card.noMatches')}</p>
            ) : (
              <ClientDevicesTable
                devices={paginatedDevices.pageItems}
                unbindingDeviceId={unbindingDeviceId}
                onUnbind={(device) => {
                  void handleUnbindDevice(device);
                }}
              />
            )}
          </div>
        )
      ) : clientCardTab === 'main' ? (
        <ClientMainFormFields
          form={mainTabForm}
          isSaving={isSaving}
          phoneError={mainTabPhoneError}
          clientVisitCount={clientVisitCount ?? historySales.length}
          onChange={updateForm}
          onFormChange={onMainTabFormChange}
          onClearPhoneError={onClearPhoneError}
          onSave={onSaveMainTab}
          onValidatePhone={onValidatePhone}
        />
      ) : clientCardTab === 'information' ? (
        <ClientInformationPanel stats={clientInfoStats} />
      ) : activeHistoryRows.length === 0 ? (
        <p className="empty-state">
          {clientCardTab === 'orders'
            ? t('clients.card.noOrders')
            : t('clients.card.noSales')}
        </p>
      ) : (
        <div className="clients-card-list">
          <ClientCardListToolbar
            totalItems={paginatedHistory.total}
            page={paginatedHistory.page}
            pageSize={CLIENT_CARD_PAGE_SIZE}
            query={listQuery}
            isFilterOpen={isListFilterOpen}
            activeFilterCount={historyActiveFilterCount}
            searchPlaceholder={t(
              clientCardTab === 'orders'
                ? 'clients.card.searchPlaceholder.orders'
                : 'clients.card.searchPlaceholder.sales',
            )}
            searchAriaLabel={t('clients.card.searchAriaLabel')}
            onPageChange={setListPage}
            onQueryChange={handleListQueryChange}
            onToggleFilter={() => setIsListFilterOpen((open) => !open)}
          />
          {isListFilterOpen ? (
            <ClientHistoryFiltersPanel
              filters={historyFilters}
              statusOptions={historyStatusOptions}
              onChange={handleHistoryFilterChange}
            />
          ) : null}
          {paginatedHistory.total === 0 ? (
            <p className="empty-state">{t('clients.card.noMatches')}</p>
          ) : (
            <ClientHistoryTable
              rows={paginatedHistory.pageItems}
              tab={clientCardTab}
              onOpenSaleCard={onOpenSaleCard}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

const ClientCardTabButton = ({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    role="tab"
    aria-selected={isActive}
    className={
      isActive ? 'clients-card-tab clients-card-tab-active' : 'clients-card-tab'
    }
    onClick={onClick}
  >
    {label}
  </button>
);

const ClientCardListToolbar = ({
  totalItems,
  page,
  pageSize,
  query,
  isFilterOpen,
  activeFilterCount,
  searchPlaceholder,
  searchAriaLabel,
  onPageChange,
  onQueryChange,
  onToggleFilter,
}: {
  totalItems: number;
  page: number;
  pageSize: number;
  query: string;
  isFilterOpen: boolean;
  activeFilterCount: number;
  searchPlaceholder: string;
  searchAriaLabel: string;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onToggleFilter: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="clients-card-list-toolbar">
      <CompactPaginationPanel
        totalItems={totalItems}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
      <button
        type="button"
        className="toolbar-filter-button toolbar-filter-toggle-button"
        aria-expanded={isFilterOpen}
        onClick={onToggleFilter}
      >
        {t('clients.card.filter')}
        {activeFilterCount > 0 ? (
          <span className="toolbar-filter-count">{activeFilterCount}</span>
        ) : null}
      </button>
      <div className="orders-search-group orders-search-group-clearable clients-card-list-search">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
        />
        {query ? (
          <button
            type="button"
            className="orders-search-clear"
            aria-label={t('clients.card.clearSearchAriaLabel')}
            onClick={() => onQueryChange('')}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
};

const ClientHistoryFiltersPanel = ({
  filters,
  statusOptions,
  onChange,
}: {
  filters: ClientHistoryListFilters;
  statusOptions: string[];
  onChange: (patch: Partial<ClientHistoryListFilters>) => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="clients-card-list-filters">
      <label className="clients-card-list-filter-field">
        <span>{t('clients.card.filters.status')}</span>
        <select
          value={filters.status}
          onChange={(event) => onChange({ status: event.target.value })}
        >
          <option value="all">{t('clients.card.filters.statusAll')}</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="clients-card-list-filter-field">
        <span>{t('clients.card.filters.dateFrom')}</span>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(event) => onChange({ dateFrom: event.target.value })}
        />
      </label>
      <label className="clients-card-list-filter-field">
        <span>{t('clients.card.filters.dateTo')}</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(event) => onChange({ dateTo: event.target.value })}
        />
      </label>
    </div>
  );
};

const ClientDeviceFiltersPanel = ({
  filters,
  onChange,
}: {
  filters: ClientDeviceListFilters;
  onChange: (patch: Partial<ClientDeviceListFilters>) => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="clients-card-list-filters">
      <label className="clients-card-list-filter-field">
        <span>{t('clients.card.filters.activity')}</span>
        <select
          value={filters.activity}
          onChange={(event) =>
            onChange({
              activity: event.target.value as ClientDeviceListFilters['activity'],
            })
          }
        >
          <option value="all">{t('clients.card.filters.activityAll')}</option>
          <option value="active">{t('clients.card.filters.active')}</option>
          <option value="inactive">{t('clients.card.filters.inactive')}</option>
        </select>
      </label>
    </div>
  );
};

const ClientInformationPanel = ({
  stats,
}: {
  stats: {
    ordersCount: number;
    ordersAmount: number;
    salesCount: number;
    salesAmount: number;
    totalCount: number;
    totalAmount: number;
    firstContactAt: string | null;
    lastContactAt: string | null;
  };
}) => {
  const { t } = useTranslation();

  return (
    <dl className="clients-card-info-list">
      <div>
        <dt>{t('clients.card.info.orders')}</dt>
        <dd>
          {stats.ordersCount} | {formatClientIncome(stats.ordersAmount)}
        </dd>
      </div>
      <div>
        <dt>{t('clients.card.info.sales')}</dt>
        <dd>
          {stats.salesCount} | {formatClientIncome(stats.salesAmount)}
        </dd>
      </div>
      <div>
        <dt>{t('clients.card.info.total')}</dt>
        <dd>
          {stats.totalCount} | {formatClientIncome(stats.totalAmount)}
        </dd>
      </div>
      <div>
        <dt>{t('clients.card.info.firstContact')}</dt>
        <dd>
          {stats.firstContactAt
            ? formatDateTime(stats.firstContactAt)
            : '-'}
        </dd>
      </div>
      <div>
        <dt>{t('clients.card.info.lastContact')}</dt>
        <dd>
          {stats.lastContactAt ? formatDateTime(stats.lastContactAt) : '-'}
        </dd>
      </div>
    </dl>
  );
};

const ClientMainFormFields = ({
  form,
  isSaving,
  phoneError,
  clientVisitCount,
  onChange,
  onFormChange,
  onClearPhoneError,
  onSave,
  onValidatePhone,
}: {
  form: ClientMainForm;
  isSaving: boolean;
  phoneError: string | null;
  clientVisitCount: number;
  onChange: <K extends keyof ClientMainForm>(
    field: K,
    value: ClientMainForm[K],
  ) => void;
  onFormChange: Dispatch<SetStateAction<ClientMainForm>>;
  onClearPhoneError: () => void;
  onSave: () => void;
  onValidatePhone: (phone: string) => boolean;
}) => {
  const { t } = useTranslation();
  const effectiveStatus = getEffectiveClientStatusLogic(
    form.status || '',
    clientVisitCount,
  );

  return (
    <div className='form-grid compact-form-grid'>
      <label className='field field-wide'>
        <span>{t('clients.card.fields.name')}</span>
        <input
          value={form.name}
          onChange={(event) => onChange('name', event.target.value)}
        />
      </label>
      <label className='field field-wide'>
        <span>{t('clients.card.fields.email')}</span>
        <input
          value={form.email}
          onChange={(event) => onChange('email', event.target.value)}
        />
      </label>
      <label className='field field-wide'>
        <span>{t('clients.card.fields.address')}</span>
        <input
          value={form.address}
          aria-invalid={!isOptionalAddressValid(form.address)}
          onChange={(event) => onChange('address', event.target.value)}
        />
        {!isOptionalAddressValid(form.address) ? (
          <small>{t('clients.messages.errors.addressMinLength')}</small>
        ) : null}
      </label>
      <PhonesField
        phone={form.phone}
        phones={form.phones}
        phoneError={phoneError}
        onPhonesUpdate={(next) =>
          onFormChange((current) => ({
            ...current,
            phone: next.phone,
            phones: next.phones,
          }))
        }
        onClearPhoneError={onClearPhoneError}
        onValidatePhone={onValidatePhone}
      />
      <label className='field field-wide'>
        <span>{t('clients.card.fields.status')}</span>
        <select
          value={effectiveStatus}
          onChange={(event) =>
            onChange('status', event.target.value as ClientStatus)
          }
        >
          {clientStatusOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              style={{
                color: getClientStatusColor(option.value),
              }}
            >
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>
      <label className='field field-wide'>
        <span>{t('clients.card.fields.companyIdOrTaxId')}</span>
        <input
          value={form.registrationId}
          aria-invalid={!isOptionalRegistrationIdValid(form.registrationId)}
          onChange={(event) =>
            onChange('registrationId', event.target.value)
          }
        />
        {!isOptionalRegistrationIdValid(form.registrationId) ? (
          <small>
            {t('clients.messages.errors.registrationIdFormat')}
          </small>
        ) : null}
      </label>
      <label className='field field-wide'>
        <span>{t('clients.card.fields.iban')}</span>
        <input
          value={form.iban}
          aria-invalid={!isOptionalIbanValid(form.iban)}
          onChange={(event) => onChange('iban', event.target.value)}
        />
        {!isOptionalIbanValid(form.iban) ? (
          <small>
            {t('clients.messages.errors.ibanFormat')}
          </small>
        ) : null}
      </label>
      <label className='field field-wide'>
        <span>{t('clients.card.fields.note')}</span>
        <textarea
          rows={4}
          value={form.note}
          onChange={(event) => onChange('note', event.target.value)}
        />
      </label>
      <div className='field field-wide'>
        <button
          type='button'
          className='primary-button clients-main-save'
          disabled={
            isSaving ||
            !form.name.trim() ||
            !(form.phone || '').trim() ||
            !(form.phones || []).some((p) => (p || '').trim()) ||
            (form.phones || [form.phone]).some((p) => (p || '').trim() && !isValidUkrainianPhone(p || '')) ||
            hasDuplicatePhones(form.phones || (form.phone ? [form.phone] : [])) ||
            !isOptionalAddressValid(form.address) ||
            !isOptionalRegistrationIdValid(form.registrationId) ||
            !isOptionalIbanValid(form.iban)
          }
          onClick={onSave}
        >
          {isSaving
            ? t('clients.card.saving')
            : t('clients.card.saveClient')}
        </button>
      </div>
    </div>
  );
};

const ClientDevicesTable = ({
  devices,
  unbindingDeviceId,
  onUnbind,
}: {
  devices: ClientDevice[];
  unbindingDeviceId: string | null;
  onUnbind: (device: ClientDevice) => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className='orders-table-wrap'>
      <table className='orders-table clients-card-table clients-card-devices-table'>
        <thead>
          <tr>
            <th>{t('clients.card.devices.columns.name')}</th>
            <th>{t('clients.card.devices.columns.note')}</th>
            <th>{t('clients.card.devices.columns.activity')}</th>
            <th>{t('clients.card.devices.columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td data-label={t('clients.card.devices.columns.name')}>
                {device.name}
              </td>
              <td data-label={t('clients.card.devices.columns.note')}>
                {device.note || '-'}
              </td>
              <td data-label={t('clients.card.devices.columns.activity')}>
                {device.isActive
                  ? t('catalog.modals.active')
                  : t('catalog.modals.inactive')}
              </td>
              <td data-label={t('clients.card.devices.columns.actions')}>
                <button
                  type='button'
                  className='ghost-button clients-device-unbind'
                  disabled={
                    !device.isActive || unbindingDeviceId === device.id
                  }
                  title={
                    !device.isActive
                      ? t('clients.card.devices.cannotUnbindInactive')
                      : undefined
                  }
                  onClick={() => onUnbind(device)}
                >
                  {unbindingDeviceId === device.id
                    ? t('clients.card.devices.unbinding')
                    : t('clients.card.devices.unbind')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ClientHistoryTable = ({
  rows,
  tab,
  onOpenSaleCard,
}: {
  rows: Sale[];
  tab: ClientCardTab;
  onOpenSaleCard: (sale: Sale) => void;
}) => {
  const { t } = useTranslation();
  const itemColumnLabel =
    tab === 'orders'
      ? t('clients.card.history.columns.service')
      : t('clients.card.history.columns.sale');

  return (
    <div className='orders-table-wrap'>
      <table className='orders-table clients-card-table'>
        <thead>
          <tr>
            <th>{t('clients.card.history.columns.number')}</th>
            <th>{t('clients.card.history.columns.date')}</th>
            <th>{itemColumnLabel}</th>
            <th>{t('clients.card.history.columns.status')}</th>
            <th>{t('clients.card.history.columns.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sale) => (
            <tr
              key={sale.id}
              className='clients-history-row'
              onClick={() => onOpenSaleCard(sale)}
            >
              <td data-label={t('clients.card.history.columns.number')}>
                <button
                  type='button'
                  className='order-number-button'
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenSaleCard(sale);
                  }}
                >
                  {sale.recordNumber ?? sale.id.slice(-6)}
                </button>
              </td>
              <td data-label={t('clients.card.history.columns.date')}>
                {formatDateTime(sale.saleDate)}
              </td>
              <td data-label={itemColumnLabel}>
                {formatItemList(sale, tab)}
              </td>
              <td data-label={t('clients.card.history.columns.status')}>
                {sale.status}
              </td>
              <td data-label={t('clients.card.history.columns.amount')}>
                {formatClientIncome(getClientSaleIncome(sale))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};