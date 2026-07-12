import { useTranslation } from 'react-i18next';
import {
  isOptionalAddressValid,
  isOptionalIbanValid,
  isOptionalRegistrationIdValid,
  normalizeIban,
  type ClientDraft,
} from '../../model/clients-workspace';
import { Modal } from '../../../../shared/ui/Modal';
import { Button } from '../../../../shared/ui/Button';

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

  const canSave =
    !isSaving &&
    form.phone.trim() &&
    form.name.trim() &&
    isOptionalAddressValid(form.address) &&
    isOptionalRegistrationIdValid(form.registrationId) &&
    isOptionalIbanValid(form.iban);

  return (
    <Modal
      isOpen
      title={t('clients.create.title')}
      onClose={onClose}
      closeLabel={t('common.close')}
      className="clients-modal"
      bodyClassName="clients-modal-body"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <Button variant="primary" disabled={!canSave} onClick={onSave}>
            {isSaving ? t('clients.create.saving') : t('clients.create.add')}
          </Button>
        </footer>
      }
    >
      <div className="form-grid compact-form-grid">
        <label className="field field-wide">
          <span>{t('clients.create.fields.phone')}</span>
          <input
            value={form.phone}
            onChange={(event) => {
              const val = event.target.value;
              const nextPhones =
                Array.isArray(form.phones) && form.phones.length > 0
                  ? [val, ...form.phones.slice(1)]
                  : [val];
              onChange({ ...form, phone: val, phones: nextPhones });
            }}
          />
        </label>
        <label className="field field-wide">
          <span>{t('clients.create.fields.name')}</span>
          <input
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
          />
        </label>
        <label className="field field-wide">
          <span>{t('clients.create.fields.address')}</span>
          <input
            value={form.address}
            aria-invalid={!isOptionalAddressValid(form.address)}
            onChange={(event) => updateForm('address', event.target.value)}
          />
          {!isOptionalAddressValid(form.address) ? (
            <small>{t('clients.messages.errors.addressMinLength')}</small>
          ) : null}
        </label>
        <label className="field field-wide">
          <span>{t('clients.create.fields.email')}</span>
          <input
            value={form.email}
            onChange={(event) => updateForm('email', event.target.value)}
          />
        </label>
        <label className="field field-wide">
          <span>{t('clients.create.fields.note')}</span>
          <textarea
            rows={4}
            value={form.note}
            onChange={(event) => updateForm('note', event.target.value)}
          />
        </label>
        <label className="field field-wide">
          <span>{t('clients.create.fields.companyIdOrTaxId')}</span>
          <input
            value={form.registrationId}
            aria-invalid={!isOptionalRegistrationIdValid(form.registrationId)}
            onChange={(event) =>
              updateForm('registrationId', event.target.value)
            }
          />
          {!isOptionalRegistrationIdValid(form.registrationId) ? (
            <small>{t('clients.messages.errors.registrationIdFormat')}</small>
          ) : null}
        </label>
        <label className="field field-wide">
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
    </Modal>
  );
};
