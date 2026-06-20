import { useTranslation } from 'react-i18next';
import type {
  Client,
  ClientStatus,
} from '../../../entities/client/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { getClientStatusColor } from '../../../entities/client/model/constants';
import { formatDateTime } from '../../../shared/lib/format';
import {
  formatClientIncome,
  formatItemList,
  isOptionalAddressValid,
  isOptionalIbanValid,
  isOptionalRegistrationIdValid,
  type ClientCardTab,
  type ClientMainForm,
} from '../model/clients-workspace';
import { isValidUkrainianPhone } from '../../../shared/lib/phoneFormatter';

type ClientStatusOption = {
  labelKey: string;
  value: ClientStatus | '';
};

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
  statusOptions: ClientStatusOption[];
  onClose: () => void;
  onMainTabFormChange: (form: ClientMainForm) => void;
  onOpenSaleCard: (sale: Sale) => void;
  onSaveMainTab: () => void;
  onTabChange: (tab: ClientCardTab) => void;
  onValidatePhone: (phone: string) => boolean;
  onClearPhoneError: () => void;
};

const clientCardTabs: Array<{ key: ClientCardTab; labelKey: string }> = [
  { key: 'main', labelKey: 'clients.tabs.main' },
  { key: 'services', labelKey: 'clients.tabs.services' },
  { key: 'sales', labelKey: 'clients.tabs.sales' },
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
  statusOptions,
  onClose,
  onMainTabFormChange,
  onOpenSaleCard,
  onSaveMainTab,
  onTabChange,
  onValidatePhone,
  onClearPhoneError,
}: ClientCardModalProps) => {
  const { t } = useTranslation();

  const updateForm = <K extends keyof ClientMainForm>(
    field: K,
    value: ClientMainForm[K],
  ) => onMainTabFormChange({ ...mainTabForm, [field]: value });

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
          {isHistoryLoading && clientCardTab !== 'main' ? (
            <p className='empty-state'>
              {t('clients.card.loadingHistory')}
            </p>
          ) : !selectedClientId ? (
            <p className='empty-state'>
              {t('clients.card.selectClient')}
            </p>
          ) : clientCardTab === 'main' ? (
            <ClientMainFormFields
              form={mainTabForm}
              isSaving={isSaving}
              phoneError={mainTabPhoneError}
              statusOptions={statusOptions}
              onChange={updateForm}
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
            <ClientHistoryTable
              rows={activeHistoryRows}
              tab={clientCardTab}
              onOpenSaleCard={onOpenSaleCard}
            />
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
  statusOptions,
  onChange,
  onClearPhoneError,
  onSave,
  onValidatePhone,
}: {
  form: ClientMainForm;
  isSaving: boolean;
  phoneError: string | null;
  statusOptions: ClientStatusOption[];
  onChange: <K extends keyof ClientMainForm>(
    field: K,
    value: ClientMainForm[K],
  ) => void;
  onClearPhoneError: () => void;
  onSave: () => void;
  onValidatePhone: (phone: string) => boolean;
}) => {
  const { t } = useTranslation();

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
      <div className='field field-wide phones-field'>
        <span>{t('clients.card.fields.phones')}</span>
        {(form.phones && form.phones.length > 0 ? form.phones : [form.phone || '']).map((ph, idx) => {
          const isPrimary = idx === 0;
          const label = isPrimary
            ? t('clients.card.fields.primaryPhone')
            : t('clients.card.fields.additionalPhone');
          const rowPhone = ph ?? '';
          return (
            <div key={idx} className='phone-row' style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
              <input
                value={rowPhone}
                placeholder={
                  isPrimary
                    ? t('clients.card.fields.primaryPhonePlaceholder')
                    : ''
                }
                style={{ flex: 1 }}
                onChange={(event) => {
                  const val = event.target.value;
                  const next = [...(form.phones && form.phones.length ? form.phones : [form.phone || ''])];
                  next[idx] = val;
                  const cleaned = next.filter((v, i) => v || i === 0);
                  onChange('phones', cleaned.length ? cleaned : ['']);
                  if (idx === 0) {
                    onChange('phone', val);
                    onClearPhoneError();
                  }
                }}
                onBlur={() => {
                  if (idx === 0) onValidatePhone(rowPhone);
                }}
              />
              <small style={{ width: '92px', color: '#64748b' }}>{label}</small>
              {!isPrimary ? (
                <button
                  type='button'
                  className='ghost-button'
                  aria-label={t('clients.card.removePhoneAriaLabel')}
                  onClick={() => {
                    const next = (form.phones || []).filter((_, i) => i !== idx);
                    onChange('phones', next.length ? next : [form.phone || '']);
                  }}
                >
                  −
                </button>
              ) : null}
            </div>
          );
        })}
        <div>
          <button
            type='button'
            className='ghost-button'
            onClick={() => {
              const current = form.phones && form.phones.length ? form.phones : [form.phone || '+380'];
              onChange('phones', [...current, '+380']);
            }}
            style={{ padding: '2px 8px', fontSize: '12px' }}
          >
            {t('clients.card.addPhone')}
          </button>
        </div>
        {phoneError ? (
          <span className='error-message'>{phoneError}</span>
        ) : null}
      </div>
      <label className='field field-wide'>
        <span>{t('clients.card.fields.status')}</span>
        <select
          value={form.status}
          onChange={(event) =>
            onChange('status', event.target.value as ClientStatus | '')
          }
        >
          {statusOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              style={{
                color: option.value
                  ? getClientStatusColor(option.value as ClientStatus)
                  : '#6B7280',
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

const hasDuplicatePhones = (phones: string[]) => {
  const seen = new Set<string>();
  for (const p of phones || []) {
    const t = (p || '').trim();
    if (!t) continue;
    if (seen.has(t)) return true;
    seen.add(t);
  }
  return false;
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
                {formatClientIncome(sale.salePrice * sale.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};