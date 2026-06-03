import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { Sale } from '../../../entities/sale/model/types';
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
}: CreateOrderSidePanelProps) => (
  <aside className="create-order-right">
    <section className="create-side-box">
      <h4>Client devices</h4>
      {deviceHistory.length ? (
        <div className="create-side-list">
          {deviceHistory.map((sale) => {
            const deviceItem = sale.lineItems?.find(
              (item) => item.kind === 'product',
            );
            const deviceNameValue =
              deviceItem?.name?.trim() || sale.product.name;
            const serialValue = sale.product.serialNumber?.trim();
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
                    id: sale.product.id,
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
        <p>Select client to view devices that were already in service.</p>
      )}
    </section>

    <section className="create-side-box">
      <h4>Client requests</h4>
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
          Orders
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
          Sales
        </button>
      </div>
      {activeClientRequests.length ? (
        <div className="create-side-list">
          {activeClientRequests.slice(0, 5).map((sale) => {
            const deviceItem = sale.lineItems?.find(
              (item) => item.kind === 'product',
            );
            const deviceNameValue =
              deviceItem?.name?.trim() || sale.product.name;
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
            ? 'No repair orders for this client yet.'
            : 'No sales orders for this client yet.'}
        </p>
      )}
    </section>

    <section className="create-side-box">
      <h4>Selected flags</h4>
      <p>
        {selectedFlags.length > 0
          ? selectedFlags.join(', ')
          : 'No flags selected.'}
      </p>
    </section>
  </aside>
);
