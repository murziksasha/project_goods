import { useTranslation } from 'react-i18next';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  getSaleProductId,
  getSaleProductName,
  getSaleProductSerialNumber,
} from '../../../entities/sale/lib/sale-product';
import {
  getOrderLink,
  type ClientRequestTab,
} from './create-order-card-shared';

type CreateOrderSidePanelProps = {
  deviceHistory: Sale[];
  activeClientRequests: Sale[];
  activeClientRequestTab: ClientRequestTab;
  selectedFlags: string[];
  onApplyDevice: (device: ClientDevice) => void;
  onClientRequestTabChange: (tab: ClientRequestTab) => void;
};

export const CreateOrderSidePanel = ({
  deviceHistory,
  activeClientRequests,
  activeClientRequestTab,
  selectedFlags,
  onApplyDevice,
  onClientRequestTabChange,
}: CreateOrderSidePanelProps) => {
  const { t } = useTranslation();

  return (
    <aside className="create-order-right">
      <section className="create-side-box">
        <h4>{t('orders.create.sidePanel.clientDevices')}</h4>
        {deviceHistory.length ? (
          <div className="create-side-list">
            {deviceHistory.map((sale) => {
              const deviceItem = sale.lineItems?.find(
                (item) => item.kind === 'product',
              );
              const deviceNameValue =
                deviceItem?.name?.trim() ||
                getSaleProductName(sale, t('orders.create.deviceFallback'));
              const serialValue = getSaleProductSerialNumber(sale);
              const displaySerial =
                serialValue && serialValue.toUpperCase() !== 'REPAIR-PLACEHOLDER'
                  ? serialValue
                  : '';
              return (
                <button
                  key={sale.id}
                  type="button"
                  className="create-side-list-button"
                  onClick={() =>
                    onApplyDevice({
                      id: getSaleProductId(sale) || sale.id,
                      clientId: sale.client.id,
                      clientName: sale.client.name,
                      clientPhone: sale.client.phone,
                      name: deviceNameValue,
                      serialNumber: displaySerial,
                      note: '',
                      source: 'repairOrder',
                      isActive: true,
                      createdAt: sale.createdAt,
                      updatedAt: sale.updatedAt,
                    })
                  }
                >
                  <strong>{deviceNameValue}</strong>
                  <span>{displaySerial || '-'}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p>{t('orders.create.sidePanel.selectClientForDevices')}</p>
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
          <div className="create-side-list">
            {activeClientRequests.slice(0, 5).map((sale) => {
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