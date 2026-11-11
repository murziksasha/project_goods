import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceCatalogFormValues } from '../../../entities/service-catalog';
import {
  PRICE_STEPPER_PRECISION,
  PRICE_STEPPER_STEP,
} from '../../../shared/lib/price-stepper';
import { NumberStepper } from '../../../shared/ui/NumberStepper';

export interface ServiceCatalogFormProps {
  form: ServiceCatalogFormValues;
  isSaving: boolean;
  isEditing: boolean;
  hideChrome?: boolean;
  onChange: <K extends keyof ServiceCatalogFormValues>(
    field: K,
    value: ServiceCatalogFormValues[K],
  ) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
}

const hasEmptyRequiredFields = (form: ServiceCatalogFormValues) =>
  !form.name.trim() || !form.price.trim();

export const ServiceCatalogForm: React.FC<
  ServiceCatalogFormProps
> = ({
  form,
  isSaving,
  isEditing,
  hideChrome = false,
  onChange,
  onSubmit,
  onCancelEdit,
}) => {
  const { t } = useTranslation();

  const fields = (
    <div className='form-grid'>
      <label className='field'>
        <span>{t('common.name')}</span>
        <input
          value={form.name}
          placeholder={t('catalog.serviceForm.namePlaceholder')}
          onChange={(event) => onChange('name', event.target.value)}
        />
      </label>

      <label className='field'>
        <span>{t('common.price')}</span>
        <NumberStepper
          min={0}
          step={PRICE_STEPPER_STEP}
          precision={PRICE_STEPPER_PRECISION}
          value={form.price}
          placeholder={t('catalog.serviceForm.pricePlaceholder')}
          onChange={(value) => onChange('price', value)}
        />
      </label>

      <label className='field'>
        <span>Cost method (default)</span>
        <select
          value={form.costMethod ?? 'fixed'}
          onChange={(event) =>
            onChange(
              'costMethod',
              event.target.value === 'time_rate' ? 'time_rate' : 'fixed',
            )
          }
        >
          <option value='fixed'>Fixed cost per service</option>
          <option value='time_rate'>Hourly rate x recorded minutes</option>
        </select>
      </label>

      {(form.costMethod ?? 'fixed') === 'fixed' ? (
        <label className='field'>
          <span>Default fixed cost (UAH)</span>
          <NumberStepper
            min={0}
            step={PRICE_STEPPER_STEP}
            precision={PRICE_STEPPER_PRECISION}
            value={form.fixedCost ?? ''}
            placeholder='Leave blank if unknown'
            onChange={(value) => onChange('fixedCost', value)}
          />
        </label>
      ) : (
        <>
          <label className='field'>
            <span>Default hourly cost (UAH/hr)</span>
            <NumberStepper
              min={0}
              step={PRICE_STEPPER_STEP}
              precision={PRICE_STEPPER_PRECISION}
              value={form.hourlyCost ?? ''}
              placeholder='0.00'
              onChange={(value) => onChange('hourlyCost', value)}
            />
          </label>
          <label className='field'>
            <span>Default duration (minutes)</span>
            <NumberStepper
              min={0}
              step={1}
              precision={0}
              value={form.defaultDurationMinutes ?? ''}
              placeholder='e.g. 30'
              onChange={(value) => onChange('defaultDurationMinutes', value)}
            />
          </label>
        </>
      )}

      <label className='field field-wide'>
        <span>{t('common.note')}</span>
        <textarea
          rows={3}
          value={form.note}
          placeholder={t('catalog.serviceForm.notePlaceholder')}
          onChange={(event) => onChange('note', event.target.value)}
        />
      </label>
    </div>
  );

  if (hideChrome) {
    return fields;
  }

  return (
    <section className='panel'>
      <div className='panel-header'>
        <div>
          <p className='section-label'>
            {isEditing ? t('common.update') : t('common.create')}
          </p>
          <h2>
            {isEditing
              ? t('catalog.serviceForm.editService')
              : t('catalog.serviceForm.addService')}
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
        ) : (
          <button
            type='button'
            className='create-order-close'
            onClick={onCancelEdit}
            aria-label={t('catalog.modals.close')}
          >
            &times;
          </button>
        )}
      </div>

      {fields}

      <button
        className='primary-button'
        type='button'
        onClick={onSubmit}
        disabled={isSaving || hasEmptyRequiredFields(form)}
      >
        {isSaving
          ? t('common.saving')
          : isEditing
            ? t('catalog.serviceForm.updateService')
            : t('catalog.serviceForm.addService')}
      </button>
    </section>
  );
};
