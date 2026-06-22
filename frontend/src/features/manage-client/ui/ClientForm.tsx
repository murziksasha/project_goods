import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clientStatuses } from '../../../entities/client/model/constants';
import type {
  Client,
  ClientFormValues,
  ClientStatus,
} from '../../../entities/client/model/types';
import { getClientPhones } from '../../../entities/client/model/forms';
import { isValidUkrainianPhone } from '../../../shared/lib/phoneFormatter';

type ClientFormProps = {
  clients: Client[];
  form: ClientFormValues;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof ClientFormValues>(
    field: K,
    value: ClientFormValues[K],
  ) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
  onPickExisting: (client: Client) => void;
};

const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 6;

const normalizeText = (value: string) => value.trim().toLowerCase();
const normalizeDigits = (value: string) => value.replace(/\D/g, '');

export const ClientForm = ({
  clients,
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onCancelEdit,
  onPickExisting,
}: ClientFormProps) => {
  const { t } = useTranslation();
  const [recommendations, setRecommendations] = useState<Client[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const normalizedName = normalizeText(form.name);
      const normalizedPhone = normalizeDigits(form.phone);

      if (!normalizedName && !normalizedPhone) {
        setRecommendations([]);
        return;
      }

      setRecommendations(
        clients
          .filter((client) => {
            const matchesName =
              !normalizedName ||
              client.name.toLowerCase().includes(normalizedName);
            const clientPhones = getClientPhones(client);
            const matchesPhone = clientPhones.some((ph) =>
              normalizeDigits(ph).includes(normalizedPhone),
            );

            return matchesName || matchesPhone;
          })
          .slice(0, MAX_SUGGESTIONS),
      );
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [clients, form.name, form.phone]);

  const validatePhone = (phone: string): boolean => {
    if (!isValidUkrainianPhone(phone)) {
      setPhoneError(t('clients.messages.errors.invalidPhoneFormat'));
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handleSubmit = () => {
    if (!validatePhone(form.phone)) {
      return;
    }
    onSubmit();
  };

  return (
    <section className='panel'>
      <div className='panel-header'>
        <div>
          <p className='section-label'>{t('legacy.clientForm.sectionLabel')}</p>
          <h2>
            {isEditing
              ? t('legacy.clientForm.editTitle')
              : t('legacy.clientForm.addTitle')}
          </h2>
        </div>
        {isEditing ? (
          <button
            className='ghost-button'
            type='button'
            onClick={onCancelEdit}
          >
            {t('common.cancel')}
          </button>
        ) : null}
      </div>

      <div className='form-grid'>
        <label className='field'>
          <span>{t('clients.modal.fields.phone')}</span>
          <input
            value={form.phone}
            placeholder='+38 067 111 22 33'
            onFocus={() => setShowRecommendations(true)}
            onBlur={() => {
              window.setTimeout(() => setShowRecommendations(false), 120);
              validatePhone(form.phone);
            }}
            onChange={(event) => {
              const val = event.target.value;
              const nextPhones =
                Array.isArray(form.phones) && form.phones.length > 0
                  ? [val, ...form.phones.slice(1)]
                  : [val];
              onChange('phone', val);
              onChange('phones', nextPhones);
              setPhoneError(null);
            }}
          />
          {phoneError ? (
            <span className='error-message'>{phoneError}</span>
          ) : null}
        </label>

        <label className='field'>
          <span>{t('clients.modal.fields.name')}</span>
          <input
            value={form.name}
            placeholder={t('legacy.clientForm.namePlaceholder')}
            onFocus={() => setShowRecommendations(true)}
            onBlur={() =>
              window.setTimeout(() => setShowRecommendations(false), 120)
            }
            onChange={(event) => onChange('name', event.target.value)}
          />
        </label>

        {showRecommendations && recommendations.length > 0 ? (
          <div className='field field-wide'>
            <span>{t('legacy.clientForm.similarClients')}</span>
            <div className='suggestions-panel'>
              {recommendations.map((client) => (
                <button
                  key={client.id}
                  className='suggestion-item'
                  type='button'
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onPickExisting(client);
                    setShowRecommendations(false);
                  }}
                >
                  <strong>{client.name}</strong>
                  <span>
                    {client.phone} • {client.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className='field field-wide'>
          <span>{t('clients.modal.fields.status')}</span>
          <select
            value={form.status}
            onChange={(event) =>
              onChange('status', event.target.value as ClientStatus)
            }
          >
            {clientStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className='field field-wide'>
          <span>{t('clients.modal.fields.note')}</span>
          <textarea
            rows={4}
            value={form.note}
            placeholder={t('legacy.clientForm.notePlaceholder')}
            onChange={(event) => onChange('note', event.target.value)}
          />
        </label>
      </div>

      <button
        className='primary-button'
        type='button'
        onClick={handleSubmit}
        disabled={
          isSaving ||
          !form.phone.trim() ||
          !form.name.trim() ||
          phoneError !== null
        }
      >
        {isSaving
          ? t('common.saving')
          : isEditing
            ? t('legacy.clientForm.updateClient')
            : t('legacy.clientForm.addClient')}
      </button>
    </section>
  );
};