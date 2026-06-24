import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ClientDevice,
  ClientDeviceFormValues,
} from '../../../entities/client-device/model/types';
import {
  filterActiveClientDevicesForClient,
  getUnbindClientDeviceAction,
  unbindClientDevice,
} from '../../../entities/client-device/lib/unbind-client-device';
import type {
  Client,
  ClientStatus,
} from '../../../entities/client/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  clientStatusOptions,
  getClientStatusClass,
  getClientStatusColor,
  getClientStatusLabelKey,
  getEffectiveClientStatusLogic,
} from '../../../entities/client/model/constants';
import { formatDateTime } from '../../../shared/lib/format';
import {
  formatClientIncome,
  getClientSaleIncome,
  formatItemList,
  isOptionalAddressValid,
  isOptionalIbanValid,
  isOptionalRegistrationIdValid,
  type ClientCardTab,
  type ClientMainForm,
} from '../model/clients-workspace';
import { isValidUkrainianPhone } from '../../../shared/lib/phoneFormatter';
import { hasDuplicatePhones } from '../../../shared/lib/phones';
import { PhonesField } from '../../../shared/ui/PhonesField';

type ClientCardModalProps = {
  activeHistoryRows: Sale[];
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
  { key: 'services', labelKey: 'clients.tabs.services' },
  { key: 'sales', labelKey: 'clients.tabs.sales' },
  { key: 'devices', labelKey: 'clients.tabs.devices' },
];

export const ClientCardModal = ({
  activeHistoryRows,
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
  const clientDeviceRows = useMemo(
    () =>
      selectedClientId
        ? filterActiveClientDevicesForClient(clientDevices, selectedClientId)
        : [],
    [clientDevices, selectedClientId],
  );
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

  return (
    <div className='modal-backdrop' role='presentation' onClick={onClose}>
      <article
        className='clients-card-modal'
        role='dialog'
        aria-modal='true'
        onClick={(event) => event.stopPropagation()}
      >
        <header className='clients-card-header'>
          <div>
            <p className='section-label'>{t('clients.card.sectionLabel')}</p>
            <h2>
              {selectedClient?.name ??
                historyClient?.name ??
                t('clients.card.titleFallback')}
            </h2>
            <p className='panel-subtitle'>
              {selectedClient?.phone ?? historyClient?.phone ?? ''}
            </p>
            {(() => {
              const visits = clientVisitCount ?? activeHistoryRows.length;
              const stored = (selectedClient?.status ?? historyClient?.status ?? '') as ClientStatus | '';
              const effective = getEffectiveClientStatusLogic(stored || '', visits);
              if (!effective) return null;
              return (
                <span
                  className={`client-status-badge ${getClientStatusClass(effective)}`}
                  style={{ backgroundColor: getClientStatusColor(effective), color: 'white', fontSize: '0.75rem', padding: '1px 6px', marginLeft: 8 }}
                >
                  {t(getClientStatusLabelKey(effective))}
                </span>
              );
            })()}
          </div>
          <button type='button' className='ghost-button' onClick={onClose}>
            x
          </button>
        </header>

        <div
          className='orders-tabs clients-card-tabs'
          role='tablist'
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

        <div className='clients-card-body'>
          {isHistoryLoading &&
          clientCardTab !== 'main' &&
          clientCardTab !== 'devices' ? (
            <p className='empty-state'>
              {t('clients.card.loadingHistory')}
            </p>
          ) : !selectedClientId ? (
            <p className='empty-state'>
              {t('clients.card.selectClient')}
            </p>
          ) : clientCardTab === 'devices' ? (
            clientDeviceRows.length === 0 ? (
              <p className='empty-state'>{t('clients.card.noDevices')}</p>
            ) : (
              <ClientDevicesTable
                devices={clientDeviceRows}
                unbindingDeviceId={unbindingDeviceId}
                onUnbind={(device) => {
                  void handleUnbindDevice(device);
                }}
              />
            )
          ) : clientCardTab === 'main' ? (
            <ClientMainFormFields
              form={mainTabForm}
              isSaving={isSaving}
              phoneError={mainTabPhoneError}
              clientVisitCount={clientVisitCount ?? activeHistoryRows.length}
              onChange={updateForm}
              onFormChange={onMainTabFormChange}
              onClearPhoneError={onClearPhoneError}
              onSave={onSaveMainTab}
              onValidatePhone={onValidatePhone}
            />
          ) : activeHistoryRows.length === 0 ? (
            <p className='empty-state'>
              {clientCardTab === 'services'
                ? t('clients.card.noServices')
                : t('clients.card.noSales')}
            </p>
          ) : (
            <>
              <div className="history-stats" style={{ marginBottom: 8 }}>
                <div className="metric-card compact">
                  <span className="metric-label">Total for client</span>
                  <strong>
                    {formatClientIncome(
                      clientTotalRevenue ??
                        activeHistoryRows.reduce(
                          (sum, sale) => sum + getClientSaleIncome(sale),
                          0,
                        ),
                    )}
                  </strong>
                </div>
              </div>
              <ClientHistoryTable
                rows={activeHistoryRows}
                tab={clientCardTab}
                onOpenSaleCard={onOpenSaleCard}
              />
            </>
          )}
        </div>
      </article>
    </div>
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
    type='button'
    className={
      isActive ? 'orders-tab orders-tab-active' : 'orders-tab'
    }
    onClick={onClick}
  >
    {label}
  </button>
);

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
    tab === 'services'
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