import { useTranslation } from 'react-i18next';
import type { ClientDevice } from '../../../../../entities/client-device/model/types';

export type OrderDetailDeviceModalProps = {
  deviceSearch: string;
  newDeviceName: string;
  clearSerialOnDeviceApply: boolean;
  isDeviceLookupLoading: boolean;
  isCreatingDevice: boolean;
  canCreateDevice: boolean;
  unbindingDeviceId: string | null;
  clientDeviceOptions: ClientDevice[];
  onDeviceSearchChange: (value: string) => void;
  onNewDeviceNameChange: (value: string) => void;
  onClearSerialOnDeviceApplyChange: (value: boolean) => void;
  onClose: () => void;
  onApplyDeviceName: (name: string) => void;
  onUnbindDevice: (device: ClientDevice) => void;
  onCreateAndApply: () => void;
};

export const OrderDetailDeviceModal = ({
  deviceSearch,
  newDeviceName,
  clearSerialOnDeviceApply,
  isDeviceLookupLoading,
  isCreatingDevice,
  canCreateDevice,
  unbindingDeviceId,
  clientDeviceOptions,
  onDeviceSearchChange,
  onNewDeviceNameChange,
  onClearSerialOnDeviceApplyChange,
  onClose,
  onApplyDeviceName,
  onUnbindDevice,
  onCreateAndApply,
}: OrderDetailDeviceModalProps) => {
  const { t } = useTranslation();

  return (
    <div
      className='modal-backdrop'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className='catalog-edit-modal order-device-change-modal'
        role='dialog'
        aria-modal='true'
        aria-label={t('orders.detail.changeDevice')}
      >
        <header className='catalog-edit-header'>
          <div className='catalog-edit-title'>
            <h2>{t('orders.detail.deviceModal.title')}</h2>
          </div>
          <button
            type='button'
            className='create-order-close'
            onClick={onClose}
            aria-label={t('orders.detail.close')}
          >
            &times;
          </button>
        </header>
        <div className='catalog-edit-body order-device-change-body'>
          <label className='field field-wide'>
            <span>{t('orders.detail.deviceModal.findDevice')}</span>
            <input
              value={deviceSearch}
              onChange={(event) => onDeviceSearchChange(event.target.value)}
              placeholder={t('orders.detail.deviceModal.searchClientDevices')}
            />
          </label>
          <div className='order-device-options' role='list'>
            {isDeviceLookupLoading ? (
              <p>{t('orders.detail.deviceModal.searchingDevices')}</p>
            ) : clientDeviceOptions.length === 0 ? (
              <p>{t('orders.detail.deviceModal.noActiveDevices')}</p>
            ) : (
              clientDeviceOptions.map((device) => (
                <div
                  key={device.id}
                  className='order-device-option-row'
                >
                  <button
                    type='button'
                    className='order-device-option'
                    onClick={() => onApplyDeviceName(device.name)}
                  >
                    <strong>{device.name}</strong>
                    {device.note ? <span>{device.note}</span> : null}
                  </button>
                  <button
                    type='button'
                    className='ghost-button order-device-unbind'
                    disabled={
                      !device.isActive || unbindingDeviceId === device.id
                    }
                    title={
                      !device.isActive
                        ? t(
                            'orders.detail.deviceModal.cannotUnbindInactive',
                          )
                        : undefined
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      void onUnbindDevice(device);
                    }}
                  >
                    {unbindingDeviceId === device.id
                      ? t('orders.detail.deviceModal.unbinding')
                      : t('orders.detail.deviceModal.unbind')}
                  </button>
                </div>
              ))
            )}
          </div>
          <label className='field field-wide'>
            <span>{t('orders.detail.deviceModal.newDevice')}</span>
            <input
              value={newDeviceName}
              onChange={(event) => onNewDeviceNameChange(event.target.value)}
              placeholder={t('orders.detail.deviceModal.deviceName')}
            />
          </label>
          <label className='create-inline-checkbox order-device-clear-serial'>
            <input
              type='checkbox'
              checked={clearSerialOnDeviceApply}
              onChange={(event) =>
                onClearSerialOnDeviceApplyChange(event.target.checked)
              }
            />
            <span>{t('orders.detail.deviceModal.clearSerial')}</span>
          </label>
        </div>
        <footer className='catalog-edit-footer'>
          <button
            type='button'
            className='secondary-button'
            onClick={onClose}
          >
            {t('orders.detail.cancel')}
          </button>
          <button
            type='button'
            className='primary-button'
            disabled={isCreatingDevice || !canCreateDevice}
            onClick={() => void onCreateAndApply()}
          >
            {isCreatingDevice
              ? t('orders.detail.creating')
              : t('orders.detail.createAndApply')}
          </button>
        </footer>
      </section>
    </div>
  );
};