import type { Dispatch, SetStateAction } from 'react';
import type {
  ServiceCenter,
  ServiceCenterFormState,
  WarehouseFormState,
} from '../model/warehouse-panel';
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
  if (!modalId) return null;

  return (
    <ModalShell
      title={modalId === 'new' ? 'create service center' : 'edit service center'}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={modalId === 'new' ? 'create' : 'save'}
      canSubmit={form.name.trim().length > 1}
    >
      <label className='field'>
        <span>name:</span>
        <input
          value={form.name}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          placeholder='name'
        />
      </label>
      <label className='field'>
        <span>color (#000000):</span>
        <div className='warehouse-settings-color-field'>
          <input
            value={form.color}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                color: event.target.value,
              }))
            }
            placeholder='#000000'
          />
          <input
            className='warehouse-settings-color-picker'
            type='color'
            aria-label='color'
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
        <span>address:</span>
        <input
          value={form.address}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              address: event.target.value,
            }))
          }
          placeholder='address'
        />
      </label>
      <label className='field'>
        <span>phone:</span>
        <input
          value={form.phone}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              phone: event.target.value,
            }))
          }
          placeholder='+380'
        />
      </label>
    </ModalShell>
  );
};

export const WarehouseEditModal = ({
  modalId,
  form,
  serviceCenters,
  onFormChange,
  onClose,
  onSubmit,
}: {
  modalId: string | null;
  form: WarehouseFormState;
  serviceCenters: ServiceCenter[];
  onFormChange: Dispatch<SetStateAction<WarehouseFormState>>;
  onClose: () => void;
  onSubmit: () => void;
}) => {
  if (!modalId) return null;

  return (
    <ModalShell
      title={modalId === 'new' ? 'create warehouse' : 'edit warehouse'}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={modalId === 'new' ? 'create' : 'save'}
      canSubmit={
        form.name.trim().length > 1 &&
        Boolean(form.serviceCenterId) &&
        form.locations.some((location) => location.trim().length > 0)
      }
    >
      <label className='field'>
        <span>name:</span>
        <input
          value={form.name}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          placeholder='name'
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
        <span>active</span>
      </label>
      <label className='field'>
        <span>Location to Service Center:</span>
        <select
          value={form.serviceCenterId}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              serviceCenterId: event.target.value,
            }))
          }
        >
          <option value=''>select service center</option>
          {serviceCenters.map((serviceCenter) => (
            <option key={serviceCenter.id} value={serviceCenter.id}>
              {serviceCenter.name}
            </option>
          ))}
        </select>
      </label>
      <label className='field'>
        <span>address for suppliers:</span>
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
        <span>phone for suppliers:</span>
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
        <span>locations:</span>
        <div className='warehouse-settings-locations'>
          {form.locations.map((location, index) => (
            <input
              key={`${modalId}-location-${index}`}
              value={location}
              onChange={(event) => {
                const nextLocations = [...form.locations];
                nextLocations[index] = event.target.value;
                onFormChange((current) => ({
                  ...current,
                  locations: nextLocations,
                }));
              }}
              placeholder='enter location name'
            />
          ))}
        </div>
        <button
          type='button'
          className='warehouse-settings-add-location'
          onClick={() =>
            onFormChange((current) => ({
              ...current,
              locations: [...current.locations, ''],
            }))
          }
        >
          location
        </button>
      </div>
    </ModalShell>
  );
};
