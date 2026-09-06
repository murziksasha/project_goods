import { useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { Supplier } from '../../../../entities/supplier/model/types';
import type { SupplierFormState } from '../../../../entities/supplier/model/forms';
import { hasDuplicatePhones } from '../../../../shared/lib/phones';
import { isValidUkrainianPhone } from '../../../../shared/lib/phoneFormatter';
import { Button } from '../../../../shared/ui/Button';
import { Modal } from '../../../../shared/ui/Modal';
import { PhonesField } from '../../../../shared/ui/PhonesField';
import { StatusBadge } from '../../../../shared/ui/StatusBadge';

type SupplierEditorModalProps = {
  duplicateSupplier?: Supplier;
  editingSupplierId: string | null;
  form: SupplierFormState;
  isSaving: boolean;
  onChange: Dispatch<SetStateAction<SupplierFormState>>;
  onClose: () => void;
  onSave: () => void;
};

export const SupplierEditorModal = ({
  duplicateSupplier,
  editingSupplierId,
  form,
  isSaving,
  onChange,
  onClose,
  onSave,
}: SupplierEditorModalProps) => {
  const { t } = useTranslation();
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const isEditing = Boolean(editingSupplierId);
  const phoneRows = form.phones?.length ? form.phones : [form.phone || ''];
  const canSave =
    !isSaving &&
    !duplicateSupplier &&
    Boolean(form.name.trim()) &&
    Boolean(form.phone.trim()) &&
    phoneRows.some((phone) => (phone || '').trim()) &&
    phoneRows.every(
      (phone) => !(phone || '').trim() || isValidUkrainianPhone(phone || ''),
    ) &&
    !hasDuplicatePhones(phoneRows);
  const updateForm = <K extends keyof SupplierFormState>(
    field: K,
    value: SupplierFormState[K],
  ) => onChange((current) => ({ ...current, [field]: value }));
  const validatePhone = (phone: string) => {
    const phoneFormatError = t('clients.messages.errors.invalidPhoneFormat');
    if (!phone.trim() || !isValidUkrainianPhone(phone)) {
      setPhoneError(phoneFormatError);
      return false;
    }
    setPhoneError(null);
    return true;
  };

  return (
    <Modal
      isOpen
      title={
        isEditing
          ? t('clients.suppliers.create.editTitle')
          : t('clients.suppliers.create.title')
      }
      onClose={onClose}
      closeLabel={t('common.close')}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      className='clients-modal'
      bodyClassName='clients-modal-body'
      headerActions={
        isEditing ? (
          <StatusBadge
            tone={form.isActive ? 'success' : 'gray'}
            label={
              form.isActive
                ? t('clients.suppliers.create.statusActive')
                : t('clients.suppliers.create.statusInactive')
            }
          />
        ) : null
      }
      footer={
        <footer className='catalog-edit-footer clients-modal-footer'>
          <Button variant='secondary' onClick={onClose} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button variant='primary' disabled={!canSave} onClick={onSave}>
            {isSaving
              ? t('clients.suppliers.create.saving')
              : isEditing
                ? t('clients.suppliers.create.save')
                : t('clients.suppliers.create.create')}
          </Button>
        </footer>
      }
    >
      <div className='form-grid compact-form-grid'>
        <label className='field'>
          <span>{t('clients.suppliers.create.fields.name')}</span>
          <input
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
          />
        </label>
        <label className='field'>
          <span>{t('clients.suppliers.create.fields.status')}</span>
          <select
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(event) =>
              updateForm('isActive', event.target.value === 'active')
            }
          >
            <option value='active'>
              {t('clients.suppliers.create.statusActive')}
            </option>
            <option value='inactive'>
              {t('clients.suppliers.create.statusInactive')}
            </option>
          </select>
        </label>
        <PhonesField
          phone={form.phone}
          phones={form.phones}
          phoneError={phoneError}
          onPhonesUpdate={(next) =>
            onChange((current) => ({
              ...current,
              phone: next.phone,
              phones: next.phones,
            }))
          }
          onClearPhoneError={() => setPhoneError(null)}
          onValidatePhone={validatePhone}
        />
        <label className='field field-wide'>
          <span>{t('clients.suppliers.create.fields.supplierOrder')}</span>
          <input
            value={form.supplierOrder}
            onChange={(event) =>
              updateForm('supplierOrder', event.target.value)
            }
          />
        </label>
        <label className='field field-wide'>
          <span>{t('clients.suppliers.create.fields.note')}</span>
          <textarea
            rows={4}
            value={form.note}
            onChange={(event) => updateForm('note', event.target.value)}
          />
        </label>
        {duplicateSupplier ? (
          <p className='error-message'>
            {t('clients.suppliers.create.duplicateError', {
              name: duplicateSupplier.name,
            })}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};
