import type React from 'react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientDevice } from '../../../../../entities/client-device';
import type { Sale, SaleLineItem } from '../../../../../entities/sale';
import { formatCurrency, formatDate } from '../../../../../shared/lib/format';
import {
  getSaleProductName,
} from '../../../../../entities/sale';
import {
  getOrderLink,
  type ClientRequestTab,
} from './create-order-card-shared';

const CLIENT_REQUESTS_SCROLL_THRESHOLD = 4;

export interface CreateOrderSidePanelProps {
  hasSelectedClient: boolean;
  registeredClientDevices: ClientDevice[];
  unbindingDeviceId: string | null;
  activeClientRequests: Sale[];
  activeClientRequestTab: ClientRequestTab;
  selectedFlags: string[];
  onApplyDevice: (device: ClientDevice) => void;
  onUnbindDevice: (device: ClientDevice) => void;
  onClientRequestTabChange: (tab: ClientRequestTab) => void;
  onOpenSerial?: (sale: Sale, item: SaleLineItem, serialNumber: string) => void;
};

interface CreateOrderRequestContentsProps {
  sale: Sale;
  onOpenSerial: CreateOrderSidePanelProps['onOpenSerial'];
}

const CreateOrderRequestContents: React.FC<CreateOrderRequestContentsProps> = ({
  sale,
  onOpenSerial,
}) => {
  const { t } = useTranslation();
  if (!sale.lineItems?.length) {
    return <p>{t('orders.create.sidePanel.noItems')}</p>;
  }

  return (['product', 'service'] as const).map((kind) => {
    const items = sale.lineItems.filter((item) => item.kind === kind);
    if (!items.length) return null;

    return (
      <section key={kind} className="create-side-request-group">
        <h5>{t(kind === 'product' ? 'orders.detail.products' : 'orders.detail.services')}</h5>
        <ul className="create-side-request-items">
          {items.map((item) => (
            <li key={item.id} className="create-side-request-item">
              <strong>{item.name}</strong>
              <dl className="create-side-request-amounts">
                <div>
                  <dt>{t('orders.create.sidePanel.quantity')}</dt>
                  <dd>{item.quantity}</dd>
                </div>
                <div>
                  <dt>{t('orders.create.sidePanel.unitPrice')}</dt>
                  <dd>{formatCurrency(item.price)}</dd>
                </div>
                <div>
                  <dt>{t('orders.create.sidePanel.lineTotal')}</dt>
                  <dd>{formatCurrency(item.price * item.quantity)}</dd>
                </div>
              </dl>
              {kind === 'product' ? (
                <div className="create-side-request-serials">
                  {(item.serialNumbers ?? [])
                    .filter((serial) => serial.trim())
                    .map((serial, index) => (
                      <button
                        key={`${serial}-${index}`}
                        type="button"
                        className="create-side-request-serial"
                        onClick={() => onOpenSerial?.(sale, item, serial)}
                      >
                        {serial}
                      </button>
                    ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    );
  });
};

export const CreateOrderSidePanel: React.FC<CreateOrderSidePanelProps> = ({
  hasSelectedClient,
  registeredClientDevices,
  unbindingDeviceId,
  activeClientRequests,
  activeClientRequestTab,
  selectedFlags,
  onApplyDevice,
  onUnbindDevice,
  onClientRequestTabChange,
  onOpenSerial,
}) => {
  const { t } = useTranslation();
  const contentsId = useId();
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleRequest = (id: string) => {
    setExpandedRequests((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
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
              const savedDeviceName = sale.product?.name?.trim() ?? '';
              const hasDeviceName = savedDeviceName &&
                !['REPAIR', 'REPAIR PLACEHOLDER'].includes(
                  savedDeviceName.toUpperCase(),
                );
              const deviceNameValue = sale.kind === 'repair'
                ? hasDeviceName
                  ? savedDeviceName
                  : t('orders.create.sidePanel.deviceNotSpecified')
                : deviceItem?.name?.trim() ||
                  getSaleProductName(sale, t('orders.create.deviceFallback'));
              const isExpanded = expandedRequests.has(sale.id);
              const requestContentsId = `${contentsId}-${sale.id}`;
              return (
                <div key={sale.id} className="create-side-list-item">
                  <div className="create-side-request-heading">
                    <span className="create-side-request-number">
                      <a
                        className="create-side-list-link"
                        href={getOrderLink(sale.id, sale.kind)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {sale.recordNumber ?? 'r------'}
                      </a>
                      <button
                        type="button"
                        className="create-side-request-toggle"
                        onClick={() => toggleRequest(sale.id)}
                        aria-expanded={isExpanded}
                        aria-controls={requestContentsId}
                        aria-label={t('orders.create.sidePanel.toggleContents', {
                          number: sale.recordNumber ?? 'r------',
                        })}
                      >
                        <span aria-hidden="true">{isExpanded ? '\u2303' : '\u2304'}</span>
                      </button>
                    </span>
                    <span>{formatDate(sale.saleDate)}</span>
                  </div>
                  <span>{deviceNameValue}</span>
                  <div id={requestContentsId} hidden={!isExpanded} className="create-side-request-contents">
                    {isExpanded ? (
                      <CreateOrderRequestContents sale={sale} onOpenSerial={onOpenSerial} />
                    ) : null}
                  </div>
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
