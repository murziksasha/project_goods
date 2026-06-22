import { useTranslation } from 'react-i18next';
import {
  isOptionalAddressValid,
  isOptionalIbanValid,
  isOptionalRegistrationIdValid,
  normalizeIban,
  type ClientDraft,
} from '../model/clients-workspace';

type ClientCreateModalProps = {
  form: ClientDraft;
  isSaving: boolean;
  onChange: (form: ClientDraft) => void;
  onClose: () => void;
  onSave: () => void;
};

export const ClientCreateModal = ({
  form,
  isSaving,
  onChange,
  onClose,
  onSave,
}: ClientCreateModalProps) => {
  const { t } = useTranslation();

  const updateForm = <K extends keyof ClientDraft>(
    field: K,
    value: ClientDraft[K],
  ) => onChange({ ...form, [field]: value });

  return (
    <div className='modal-backdrop' role='presentation' onClick={onClose}>
      <article
        className='catalog-edit-modal clients-modal'
        role='dialog'
        aria-modal='true'
        onClick={(event) => event.stopPropagation()}
      >
        <header className='catalog-edit-header'>
          <h2>{t('clients.create.title')}</h2>
          <button type='button' className='ghost-button' onClick={onClose}>
            x
          </button>
        </header>
        <div className='catalog-edit-body clients-modal-body'>
          <div className='form-grid compact-form-grid'>
            <label className='field field-wide'>
              <span>{t('clients.create.fields.phone')}</span>
              <input
                value={form.phone}
                onChange={(event) => {
                  const val = event.target.value;
                  const nextPhones = Array.isArray(form.phones) && form.phones.length > 0
                    ? [val, ...form.phones.slice(1)]
                    : [val];
                  onChange({ ...form, phone: val, phones: nextPhones });
                }}
              />
            </label>
            <label className='field field-wide'>
              <span>{t('clients.create.fields.name')}</span>
              <input
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
              />
            </label>
            <label className='field field-wide'>
              <span>{t('clients.create.fields.address')}</span>
              <input
                value={form.address}
                aria-invalid={!isOptionalAddressValid(form.address)}
                onChange={(event) =>
                  updateForm('address', event.target.value)
                }
              />
              {!isOptionalAddressValid(form.address) ? (
                <small>{t('clients.messages.errors.addressMinLength')}</small>
              ) : null}
            </label>
            <label className='field field-wide'>
              <span>{t('clients.create.fields.email')}</span>
              <input
                value={form.email}
                onChange={(event) => updateForm('email', event.target.value)}
              />
            </label>
            <label className='field field-wide'>
              <span>{t('clients.create.fields.note')}</span>
              <textarea
                rows={4}
                value={form.note}
                onChange={(event) => updateForm('note', event.target.value)}
              />
            </label>
            <label className='field field-wide'>
              <span>{t('clients.create.fields.companyIdOrTaxId')}</span>
              <input
                value={form.registrationId}
                aria-invalid={
                  !isOptionalRegistrationIdValid(form.registrationId)
                }
                onChange={(event) =>
                  updateForm('registrationId', event.target.value)
                }
              />
              {!isOptionalRegistrationIdValid(form.registrationId) ? (
                <small>
                  {t('clients.messages.errors.registrationIdFormat')}
                </small>
              ) : null}
            </label>
            <label className='field field-wide'>
              <span>{t('clients.create.fields.iban')}</span>
              <input
                value={form.iban}
                aria-invalid={!isOptionalIbanValid(form.iban)}
                onBlur={() => updateForm('iban', normalizeIban(form.iban))}
                onChange={(event) => updateForm('iban', event.target.value)}
              />
              {!isOptionalIbanValid(form.iban) ? (
                <small>{t('clients.messages.errors.ibanFormat')}</small>
              ) : null}
            </label>
          </div>
        </div>
        <footer className='catalog-edit-footer'>
          <button
            type='button'
            className='primary-button'
            disabled={
              isSaving ||
              !form.phone.trim() ||
              !form.name.trim() ||
              !isOptionalAddressValid(form.address) ||
              !isOptionalRegistrationIdValid(form.registrationId) ||
              !isOptionalIbanValid(form.iban)
            }
            onClick={onSave}
          >
            {isSaving ? t('clients.create.saving') : t('clients.create.add')}
          </button>
        </footer>
      </article>
    </div>
  );
};