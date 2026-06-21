import { useTranslation } from 'react-i18next';
import {
  addPhoneRow,
  getPhoneRows,
  removePhoneAtIndex,
  setPrimaryPhoneAtIndex,
  updatePhoneAtIndex,
  type PhoneFieldState,
} from '../lib/phones';

type PhonesFieldProps = {
  phone: string;
  phones?: string[];
  phoneError?: string | null;
  onPhonesUpdate: (next: PhoneFieldState) => void;
  onValidatePhone?: (phone: string) => boolean;
  onClearPhoneError?: () => void;
};

export const PhonesField = ({
  phone,
  phones,
  phoneError,
  onPhonesUpdate,
  onValidatePhone,
  onClearPhoneError,
}: PhonesFieldProps) => {
  const { t } = useTranslation();
  const phoneRows = getPhoneRows(phone, phones);
  const canRemoveRow = phoneRows.length > 1;

  const handleBlur = (rowPhone: string) => {
    const trimmed = (rowPhone || '').trim();
    if (!trimmed) return;
    onValidatePhone?.(trimmed);
  };

  return (
    <div className='field field-wide phones-field'>
      <span>{t('clients.card.fields.phones')}</span>
      {phoneRows.map((rowPhone, index) => {
        const isPrimary = index === 0;
        const label = isPrimary
          ? t('clients.card.fields.primaryPhone')
          : t('clients.card.fields.additionalPhone');

        return (
          <div key={`phone-row-${index}`} className='phone-row'>
            <input
              value={rowPhone ?? ''}
              placeholder={
                isPrimary
                  ? t('clients.card.fields.primaryPhonePlaceholder')
                  : ''
              }
              onChange={(event) => {
                const next = updatePhoneAtIndex(
                  phone,
                  phones,
                  index,
                  event.target.value,
                );
                onPhonesUpdate(next);
                onClearPhoneError?.();
              }}
              onBlur={() => handleBlur(rowPhone ?? '')}
            />
            <small className='phone-row-label'>{label}</small>
            <div className='phone-row-actions'>
              {!isPrimary ? (
                <button
                  type='button'
                  className='ghost-button phone-primary-action'
                  aria-label={t('clients.card.setPrimaryPhoneAriaLabel')}
                  title={t('clients.card.setPrimaryPhone')}
                  onClick={() => {
                    onPhonesUpdate(setPrimaryPhoneAtIndex(phone, phones, index));
                    onClearPhoneError?.();
                  }}
                >
                  ★
                </button>
              ) : null}
              {canRemoveRow ? (
                <button
                  type='button'
                  className='ghost-button'
                  aria-label={t('clients.card.removePhoneAriaLabel')}
                  onClick={() => {
                    onPhonesUpdate(removePhoneAtIndex(phone, phones, index));
                    onClearPhoneError?.();
                  }}
                >
                  −
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      <div>
        <button
          type='button'
          className='ghost-button'
          onClick={() => onPhonesUpdate(addPhoneRow(phone, phones))}
        >
          {t('clients.card.addPhone')}
        </button>
      </div>
      {phoneError ? <span className='error-message'>{phoneError}</span> : null}
    </div>
  );
};