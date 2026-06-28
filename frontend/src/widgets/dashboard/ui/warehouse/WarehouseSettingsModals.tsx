import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ServiceCenter,
  ServiceCenterFormState,
  WarehouseFormState,
} from '../../model/warehouse-panel';
import { ModalShell } from './WarehouseModalShell';

export const ServiceCenterModal = ({
  modalId,
  form,
  onFormChange,
  onClose,
  onSubmit,
}: {
  modalId: string | null;
  form: ServiceCenterFormState;
  onFormChange: Dispatch<SetStateAction<ServiceCenterFormState>>;
  onClose: () => void;
  onSubmit: () => void;
}) => {
  const { t } = useTranslation();

  if (!modalId) return null;

  return (
    <ModalShell
      title={
        modalId === 'new'
          ? t('warehouse.modals.serviceCenter.createTitle')
          : t('warehouse.modals.serviceCenter.editTitle')
      }
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={
        modalId === 'new'
          ? t('warehouse.common.create')
          : t('warehouse.common.save')
      }
      canSubmit={form.name.trim().length > 1}
    >
      <label className='field'>
        <span>{t('warehouse.modals.serviceCenter.nameLabel')}</span>
        <input
          value={form.name}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          placeholder={t('warehouse.modals.serviceCenter.namePlaceholder')}
        />
      </label>
      <label className='field'>
        <span>{t('warehouse.modals.serviceCenter.colorLabel')}</span>
        <div className='warehouse-settings-color-field'>
          <input
            value={form.color}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                color: event.target.value,
              }))
            }
            placeholder={t('warehouse.modals.serviceCenter.colorPlaceholder')}
          />
          <input
            className='warehouse-settings-color-picker'
            type='color'
            aria-label={t('warehouse.modals.serviceCenter.colorAriaLabel')}
            value={form.color}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                color: event.target.value,
              }))
            }
          />
        </div>
      </label>
      <label className='field'>
        <span>{t('warehouse.modals.serviceCenter.addressLabel')}</span>
        <input
          value={form.address}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              address: event.target.value,
            }))
          }
          placeholder={t('warehouse.modals.serviceCenter.addressPlaceholder')}
        />
      </label>
      <label className='field'>
        <span>{t('warehouse.modals.serviceCenter.phoneLabel')}</span>
        <input
          value={form.phone}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              phone: event.target.value,
            }))
          }
          placeholder={t('warehouse.modals.serviceCenter.phonePlaceholder')}
        />
      </label>
    </ModalShell>
  );
};

export const WarehouseEditModal = ({
  modalId,
  form,
  serviceCenters,
  locationUsage,
  onFormChange,
  onClose,
  onSubmit,
}: {
  modalId: string | null;
  form: WarehouseFormState;
  serviceCenters: ServiceCenter[];
  locationUsage: Record<string, number>;
  onFormChange: Dispatch<SetStateAction<WarehouseFormState>>;
  onClose: () => void;
  onSubmit: () => void;
}) => {
  const { t } = useTranslation();

  if (!modalId) return null;
  const normalizedLocationNames = form.locations
    .map((location) => location.name.trim().toLowerCase())
    .filter(Boolean);
  const hasDuplicateLocations =
    new Set(normalizedLocationNames).size !== normalizedLocationNames.length;

  return (
    <ModalShell
      title={
        modalId === 'new'
          ? t('warehouse.modals.warehouse.createTitle')
          : t('warehouse.modals.warehouse.editTitle')
      }
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={
        modalId === 'new'
          ? t('warehouse.common.create')
          : t('warehouse.common.save')
      }
      canSubmit={
        form.name.trim().length > 1 &&
        Boolean(form.serviceCenterId) &&
        form.locations.some((location) => location.name.trim().length > 0) &&
        !hasDuplicateLocations
      }
    >
      <label className='field'>
        <span>{t('warehouse.modals.warehouse.nameLabel')}</span>
        <input
          value={form.name}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          placeholder={t('warehouse.modals.warehouse.namePlaceholder')}
        />
      </label>
      <label className='create-inline-checkbox'>
        <input
          type='checkbox'
          checked={form.isActive}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              isActive: event.target.checked,
            }))
          }
        />
        <span>{t('warehouse.modals.warehouse.active')}</span>
      </label>
      <label className='field'>
        <span>{t('warehouse.modals.warehouse.serviceCenterLabel')}</span>
        <select
          value={form.serviceCenterId}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              serviceCenterId: event.target.value,
            }))
          }
        >
          <option value=''>
            {t('warehouse.modals.warehouse.selectServiceCenter')}
          </option>
          {serviceCenters.map((serviceCenter) => (
            <option key={serviceCenter.id} value={serviceCenter.id}>
              {serviceCenter.name}
            </option>
          ))}
        </select>
      </label>
      <label className='field'>
        <span>{t('warehouse.modals.warehouse.receiptAddressLabel')}</span>
        <input
          value={form.receiptAddress}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              receiptAddress: event.target.value,
            }))
          }
        />
      </label>
      <label className='field'>
        <span>{t('warehouse.modals.warehouse.receiptPhoneLabel')}</span>
        <input
          value={form.receiptPhone}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              receiptPhone: event.target.value,
            }))
          }
        />
      </label>
      <div className='field'>
        <span>{t('warehouse.modals.warehouse.locationsLabel')}</span>
        <div className='warehouse-settings-locations'>
          {form.locations.map((location, index) => {
            const usageCount = locationUsage[location.id] ?? 0;
            const canRemove =
              form.locations.length > 1 && usageCount === 0;
            return (
              <div
                key={location.id || `${modalId}-location-${index}`}
                className='warehouse-settings-location-row'
              >
                <input
                  value={location.name}
                  onChange={(event) => {
                    const nextLocations = form.locations.map(
                      (currentLocation, locationIndex) =>
                        locationIndex === index
                          ? {
                              ...currentLocation,
                              name: event.target.value,
                            }
                          : currentLocation,
                    );
                    onFormChange((current) => ({
                      ...current,
                      locations: nextLocations,
                    }));
                  }}
                  placeholder={t(
                    'warehouse.modals.warehouse.locationNamePlaceholder',
                  )}
                />
                <span
                  className='warehouse-settings-location-usage'
                  title={t('warehouse.modals.warehouse.locationUsageTitle')}
                >
                  {usageCount}
                </span>
                <button
                  type='button'
                  className='danger-button warehouse-settings-location-delete'
                  disabled={!canRemove}
                  onClick={() =>
                    onFormChange((current) => ({
                      ...current,
                      locations: current.locations.filter(
                        (_, locationIndex) => locationIndex !== index,
                      ),
                    }))
                  }
                >
                  {t('warehouse.common.delete')}
                </button>
              </div>
            );
          })}
        </div>
        {hasDuplicateLocations ? (
          <small>
            {t('warehouse.modals.warehouse.duplicateLocationsError')}
          </small>
        ) : null}
        <button
          type='button'
          className='warehouse-settings-add-location'
          onClick={() =>
            onFormChange((current) => ({
              ...current,
              locations: [
                ...current.locations,
                { id: `l-${Date.now()}`, name: '' },
              ],
            }))
          }
        >
          {t('warehouse.modals.warehouse.addLocation')}
        </button>
      </div>
    </ModalShell>
  );
};