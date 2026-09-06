import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettingsFormValues } from '../../../../entities/settings/model/types';
import {
  readUiDensity,
  writeUiDensity,
  type UiDensity,
} from '../../../../shared/lib/uiDensity';
import { getCompanyValidation } from '../../model/settings-panel';

type SettingsChangeHandler = <K extends keyof AppSettingsFormValues>(
  field: K,
  value: AppSettingsFormValues[K],
) => void;

type CompanySettingsSectionProps = {
  form: AppSettingsFormValues;
  validation: ReturnType<typeof getCompanyValidation>;
  onChange: SettingsChangeHandler;
};

const TokenField = ({
  id,
  label,
  token,
  value,
  placeholder,
  invalid,
  error,
  type = 'text',
  onChange,
}: {
  id: string;
  label: string;
  token: string;
  value: string;
  placeholder: string;
  invalid?: boolean;
  error?: string;
  type?: string;
  onChange: (value: string) => void;
}) => (
  <div className="field">
    <div className="settings-field-label">
      <label htmlFor={id}>{label}</label>
      <code className="settings-token" aria-hidden="true">
        {token}
      </code>
    </div>
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-invalid={invalid}
    />
    {error ? <small>{error}</small> : null}
  </div>
);

export const CompanySettingsSection = ({
  form,
  validation,
  onChange,
}: CompanySettingsSectionProps) => {
  const { t } = useTranslation();
  const [uiDensity, setUiDensity] = useState<UiDensity>(() => readUiDensity());

  return (
    <section className="settings-section">
      <article className="settings-group">
        <div className="settings-group-header">
          <h3>{t('settings.company.appearanceTitle')}</h3>
          <p className="panel-subtitle">{t('settings.ui.appearance')}</p>
        </div>
        <div className="form-grid">
          <label className="field field-wide" htmlFor="settings-service-name">
            <span>{t('settings.company.serviceNameInHeader')}</span>
            <input
              id="settings-service-name"
              value={form.serviceName}
              onChange={(event) => onChange('serviceName', event.target.value)}
              placeholder={t('settings.company.serviceNamePlaceholder')}
            />
          </label>
          <label className="field field-wide" htmlFor="settings-ui-density">
            <span>{t('settings.ui.density')}</span>
            <select
              id="settings-ui-density"
              value={uiDensity}
              onChange={(event) => {
                const next = event.target.value as UiDensity;
                setUiDensity(next);
                writeUiDensity(next);
              }}
            >
              <option value="comfortable">{t('settings.ui.densityComfortable')}</option>
              <option value="compact">{t('settings.ui.densityCompact')}</option>
            </select>
            <small className="muted-copy">{t('settings.ui.densityHint')}</small>
          </label>
        </div>
      </article>

      <article className="settings-group">
        <div className="settings-group-header">
          <h3>{t('settings.company.identityTitle')}</h3>
          <p className="panel-subtitle">{t('settings.company.identitySubtitle')}</p>
        </div>
        <div className="form-grid">
          <TokenField
            id="settings-company-name"
            label={t('settings.company.companyName')}
            token="{{company}}"
            value={form.company}
            placeholder={t('settings.company.companyNamePlaceholder')}
            invalid={!validation.isCompanyNameValid}
            error={
              validation.isCompanyNameValid
                ? undefined
                : t('settings.company.companyNameMinLength')
            }
            onChange={(value) => onChange('company', value)}
          />
          <TokenField
            id="settings-company-id"
            label={t('settings.company.companyId')}
            token="{{company_id}}"
            value={form.companyId}
            placeholder={t('settings.company.companyIdPlaceholder')}
            invalid={!validation.isCompanyIdValid}
            error={
              validation.isCompanyIdValid
                ? undefined
                : t('settings.company.companyIdFormat')
            }
            onChange={(value) => onChange('companyId', value)}
          />
          <div className="field field-wide">
            <div className="settings-field-label">
              <label htmlFor="settings-company-address">
                {t('settings.company.companyAddress')}
              </label>
              <code className="settings-token" aria-hidden="true">
                {'{{company_address}}'}
              </code>
            </div>
            <input
              id="settings-company-address"
              value={form.companyAddress}
              onChange={(event) => onChange('companyAddress', event.target.value)}
              placeholder={t('settings.company.companyAddressPlaceholder')}
              aria-invalid={!validation.isCompanyAddressValid}
            />
            {!validation.isCompanyAddressValid ? (
              <small>{t('settings.company.companyAddressMinLength')}</small>
            ) : null}
          </div>
          <div className="field field-wide">
            <div className="settings-field-label">
              <label htmlFor="settings-company-iban">
                {t('settings.company.companyIban')}
              </label>
              <code className="settings-token" aria-hidden="true">
                {'{{company_iban}}'}
              </code>
            </div>
            <input
              id="settings-company-iban"
              value={form.companyIban}
              onChange={(event) => onChange('companyIban', event.target.value)}
              placeholder={t('settings.company.companyIbanPlaceholder')}
              aria-invalid={!validation.isCompanyIbanValid}
            />
            {!validation.isCompanyIbanValid ? (
              <small>{t('settings.company.companyIbanFormat')}</small>
            ) : null}
          </div>
          <TokenField
            id="settings-company-email"
            label={t('settings.company.companyEmail')}
            token="{{company_email}}"
            type="email"
            value={form.companyEmail}
            placeholder={t('settings.company.companyEmailPlaceholder')}
            onChange={(value) => onChange('companyEmail', value)}
          />
          <TokenField
            id="settings-company-site"
            label={t('settings.company.companySite')}
            token="{{company_site}}"
            type="url"
            value={form.companySite}
            placeholder={t('settings.company.companySitePlaceholder')}
            onChange={(value) => onChange('companySite', value)}
          />
        </div>
      </article>
    </section>
  );
};
