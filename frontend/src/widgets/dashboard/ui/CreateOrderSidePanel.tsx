import { useTranslation } from 'react-i18next';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  getSaleProductName,
} from '../../../entities/sale/lib/sale-product';
import {
  getOrderLink,
  type ClientRequestTab,
} from './create-order-card-shared';

const CLIENT_REQUESTS_SCROLL_THRESHOLD = 4;

type CreateOrderSidePanelProps = {
  hasSelectedClient: boolean;
  registeredClientDevices: ClientDevice[];
  unbindingDeviceId: string | null;
  activeClientRequests: Sale[];
  activeClientRequestTab: ClientRequestTab;
  selectedFlags: string[];
  onApplyDevice: (device: ClientDevice) => void;
  onUnbindDevice: (device: ClientDevice) => void;
  onClientRequestTabChange: (tab: ClientRequestTab) => void;
};

export const CreateOrderSidePanel = ({
  hasSelectedClient,
  registeredClientDevices,
  unbindingDeviceId,
  activeClientRequests,
  activeClientRequestTab,
  selectedFlags,
  onApplyDevice,
  onUnbindDevice,
  onClientRequestTabChange,
}: CreateOrderSidePanelProps) => {
  const { t } = useTranslation();
  const shouldScrollClientRequests =
    activeClientRequests.length >= CLIENT_REQUESTS_SCROLL_THRESHOLD;

  return (
    <aside className="create-order-right">
      <section className="create-side-box">
        <h4>{t('orders.create.sidePanel.clientDevices')}</h4>
        {!hasSelectedClient ? (
          <p>{t('orders.create.sidePanel.selectClientForDevices')}</p>
        ) : registeredClientDevices.length ? (
          <div className="create-side-list">
            {registeredClientDevices.map((device) => (
              <div key={device.id} className="create-side-device-row">
                <button
                  type="button"
                  className="create-side-device-apply"
                  onClick={() => onApplyDevice(device)}
                >
                  <strong>{device.name}</strong>
                  <span>{device.serialNumber || '-'}</span>
                </button>
                <button
                  type="button"
                  className="ghost-button create-side-device-unbind"
                  disabled={
                    !device.isActive || unbindingDeviceId === device.id
                  }
                  title={
                    !device.isActive
                      ? t('clients.card.devices.cannotUnbindInactive')
                      : undefined
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onUnbindDevice(device);
                  }}
                >
                  {unbindingDeviceId === device.id
                    ? t('clients.card.devices.unbinding')
                    : t('clients.card.devices.unbind')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p>{t('clients.card.noDevices')}</p>
        )}
      </section>

      <section className="create-side-box">
        <h4>{t('orders.create.sidePanel.clientRequests')}</h4>
        <div className="order-related-tabs">
          <button
            type="button"
            className={
              activeClientRequestTab === 'orders'
                ? 'order-related-tab order-related-tab-active'
                : 'order-related-tab'
            }
            onClick={() => onClientRequestTabChange('orders')}
          >
            {t('orders.tabs.orders')}
          </button>
          <button
            type="button"
            className={
              activeClientRequestTab === 'sales'
                ? 'order-related-tab order-related-tab-active'
                : 'order-related-tab'
            }
            onClick={() => onClientRequestTabChange('sales')}
          >
            {t('orders.tabs.sales')}
          </button>
        </div>
        {activeClientRequests.length ? (
          <div
            className={
              shouldScrollClientRequests
                ? 'create-side-list create-side-requests-list create-side-requests-list-scrollable'
                : 'create-side-list create-side-requests-list'
            }
          >
            {activeClientRequests.map((sale) => {
              const deviceItem = sale.lineItems?.find(
                (item) => item.kind === 'product',
              );
              const deviceNameValue =
                deviceItem?.name?.trim() ||
                getSaleProductName(sale, t('orders.create.deviceFallback'));
              return (
                <div key={sale.id} className="create-side-list-item">
                  <a
                    className="create-side-list-link"
                    href={getOrderLink(sale.id, sale.kind)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {sale.recordNumber ?? 'r------'}
                  </a>
                  <span>{deviceNameValue}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p>
            {activeClientRequestTab === 'orders'
              ? t('orders.create.sidePanel.noRepairOrders')
              : t('orders.create.sidePanel.noSalesOrders')}
          </p>
        )}
      </section>

      <section className="create-side-box">
        <h4>{t('orders.create.sidePanel.selectedFlags')}</h4>
        <p>
          {selectedFlags.length > 0
            ? selectedFlags.join(', ')
            : t('orders.create.sidePanel.noFlagsSelected')}
        </p>
      </section>
    </aside>
  );
};