import { useTranslation } from 'react-i18next';
import { getPhoneRows } from '../lib/phones';

type PhonesFieldProps = {
  phone: string;
  phones?: string[];
  phoneError?: string | null;
  onPhoneChange: (phone: string) => void;
  onPhonesChange: (phones: string[]) => void;
  onValidatePhone?: (phone: string) => void;
  onClearPhoneError?: () => void;
};

export const PhonesField = ({
  phone,
  phones,
  phoneError,
  onPhoneChange,
  onPhonesChange,
  onValidatePhone,
  onClearPhoneError,
}: PhonesFieldProps) => {
  const { t } = useTranslation();
  const phoneRows = getPhoneRows(phone, phones);

  return (
    <div className='field field-wide phones-field'>
      <span>{t('clients.card.fields.phones')}</span>
      {phoneRows.map((rowPhone, index) => {
        const isPrimary = index === 0;
        const label = isPrimary
          ? t('clients.card.fields.primaryPhone')
          : t('clients.card.fields.additionalPhone');

        return (
          <div
            key={index}
            className='phone-row'
            style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <input
              value={rowPhone ?? ''}
              placeholder={
                isPrimary
                  ? t('clients.card.fields.primaryPhonePlaceholder')
                  : ''
              }
              style={{ flex: 1 }}
              onChange={(event) => {
                const value = event.target.value;
                const next = [...phoneRows];
                next[index] = value;
                const cleaned = next.filter((item, itemIndex) => item || itemIndex === 0);
                onPhonesChange(cleaned.length ? cleaned : ['']);
                if (index === 0) {
                  onPhoneChange(value);
                  onClearPhoneError?.();
                }
              }}
              onBlur={() => {
                if (index === 0) {
                  onValidatePhone?.(rowPhone ?? '');
                }
              }}
            />
            <small style={{ width: '92px', color: '#64748b' }}>{label}</small>
            {!isPrimary ? (
              <button
                type='button'
                className='ghost-button'
                aria-label={t('clients.card.removePhoneAriaLabel')}
                onClick={() => {
                  const next = phoneRows.filter((_, itemIndex) => itemIndex !== index);
                  onPhonesChange(next.length ? next : [phone || '']);
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
            const current = getPhoneRows(phone, phones);
            onPhonesChange([...current, '+380']);
          }}
          style={{ padding: '2px 8px', fontSize: '12px' }}
        >
          {t('clients.card.addPhone')}
        </button>
      </div>
      {phoneError ? <span className='error-message'>{phoneError}</span> : null}
    </div>
  );
};