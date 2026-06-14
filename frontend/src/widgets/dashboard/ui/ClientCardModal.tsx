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

type ClientStatusOption = {
  label: string;
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
            <p className='section-label'>Client</p>
            <h2>
              {selectedClient?.name ??
                historyClient?.name ??
                'Client card'}
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
          aria-label='Client card'
        >
          <ClientCardTabButton
            isActive={clientCardTab === 'main'}
            label='Main'
            onClick={() => onTabChange('main')}
          />
          <ClientCardTabButton
            isActive={clientCardTab === 'services'}
            label='Services'
            onClick={() => onTabChange('services')}
          />
          <ClientCardTabButton
            isActive={clientCardTab === 'sales'}
            label='Sales'
            onClick={() => onTabChange('sales')}
          />
        </div>

        <div className='clients-card-body'>
          {isHistoryLoading && clientCardTab !== 'main' ? (
            <p className='empty-state'>
              Loading client history...
            </p>
          ) : !selectedClientId ? (
            <p className='empty-state'>
              Select a client from the list.
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
                ? 'No services found for this client.'
                : 'No sales found for this client.'}
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
}) => (
  <div className='form-grid compact-form-grid'>
    <label className='field field-wide'>
      <span>Name</span>
      <input
        value={form.name}
        onChange={(event) => onChange('name', event.target.value)}
      />
    </label>
    <label className='field field-wide'>
      <span>Email</span>
      <input
        value={form.email}
        onChange={(event) => onChange('email', event.target.value)}
      />
    </label>
    <label className='field field-wide'>
      <span>Address</span>
      <input
        value={form.address}
        aria-invalid={!isOptionalAddressValid(form.address)}
        onChange={(event) => onChange('address', event.target.value)}
      />
      {!isOptionalAddressValid(form.address) ? (
        <small>Address must contain at least 5 characters.</small>
      ) : null}
    </label>
    <label className='field field-wide'>
      <span>Phone</span>
      <input
        value={form.phone}
        onChange={(event) => {
          onChange('phone', event.target.value);
          onClearPhoneError();
        }}
        onBlur={() => onValidatePhone(form.phone)}
      />
      {phoneError ? (
        <span className='error-message'>{phoneError}</span>
      ) : null}
    </label>
    <label className='field field-wide'>
      <span>Status</span>
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
            {option.label}
          </option>
        ))}
      </select>
    </label>
    <label className='field field-wide'>
      <span>Company ID or tax ID</span>
      <input
        value={form.registrationId}
        aria-invalid={!isOptionalRegistrationIdValid(form.registrationId)}
        onChange={(event) =>
          onChange('registrationId', event.target.value)
        }
      />
      {!isOptionalRegistrationIdValid(form.registrationId) ? (
        <small>
          Value must contain 8-12 characters: letters, digits, or a hyphen.
        </small>
      ) : null}
    </label>
    <label className='field field-wide'>
      <span>IBAN</span>
      <input
        value={form.iban}
        aria-invalid={!isOptionalIbanValid(form.iban)}
        onChange={(event) => onChange('iban', event.target.value)}
      />
      {!isOptionalIbanValid(form.iban) ? (
        <small>
          IBAN must match UA + 27 digits. Spaces are allowed.
        </small>
      ) : null}
    </label>
    <label className='field field-wide'>
      <span>Note</span>
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
          !form.phone.trim() ||
          !isOptionalAddressValid(form.address) ||
          !isOptionalRegistrationIdValid(form.registrationId) ||
          !isOptionalIbanValid(form.iban)
        }
        onClick={onSave}
      >
        {isSaving ? 'Saving...' : 'Save client'}
      </button>
    </div>
  </div>
);

const ClientHistoryTable = ({
  rows,
  tab,
  onOpenSaleCard,
}: {
  rows: Sale[];
  tab: ClientCardTab;
  onOpenSaleCard: (sale: Sale) => void;
}) => (
  <div className='orders-table-wrap'>
    <table className='orders-table clients-card-table'>
      <thead>
        <tr>
          <th>No.</th>
          <th>Date</th>
          <th>{tab === 'services' ? 'Service' : 'Sale'}</th>
          <th>Status</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((sale) => (
          <tr
            key={sale.id}
            className='clients-history-row'
            onClick={() => onOpenSaleCard(sale)}
          >
            <td data-label='No.'>
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
            <td data-label='Date'>{formatDateTime(sale.saleDate)}</td>
            <td data-label={tab === 'services' ? 'Service' : 'Sale'}>
              {formatItemList(sale, tab)}
            </td>
            <td data-label='Status'>{sale.status}</td>
            <td data-label='Amount'>{formatClientIncome(sale.salePrice * sale.quantity)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
