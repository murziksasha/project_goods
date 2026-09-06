import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Cashbox,
  SupplierOrderPaymentQueueItem,
} from '../../../../entities/finance/model/types';
import type { SupplierOrder } from '../../../../entities/supplier-order/model/types';
import {
  findSupplierOrderForQueueItem,
  formatDateDdMmYyyy,
  formatMoney,
  type FinanceOverview,
} from '../../model/accounting';
import { TruncatedTextTooltip } from '../../../../shared/ui/TruncatedTextTooltip';
import { formatMetric } from '../../model/sales-analytics';
import { getSupplierOrderDisplayNumber } from '../../model/supplier-order-utils';
import { PaySupplierOrderModal } from './AccountingConfirmModals';

type AccountingSupplierOrdersQueueProps = {
  canIssueSupplierOrdersWithoutPayment: boolean;
  canPaySupplierOrders: boolean;
  cashboxes: Cashbox[];
  financeOverview: FinanceOverview;
  firstCashboxId: string;
  isSaving: boolean;
  payingOrderId: string | null;
  supplierOrders: SupplierOrder[];
  supplierOrdersQueue: SupplierOrderPaymentQueueItem[];
  onIssueWithoutPayment: (order: SupplierOrderPaymentQueueItem) => void;
  onPaySupplierOrder: (
    order: SupplierOrderPaymentQueueItem,
    cashboxId: string,
    orderNumber: string,
  ) => void;
  onSelectedSupplierOrderChange: (order: SupplierOrder) => void;
};

export const AccountingSupplierOrdersQueue = ({
  canIssueSupplierOrdersWithoutPayment,
  canPaySupplierOrders,
  cashboxes,
  financeOverview,
  firstCashboxId,
  isSaving,
  payingOrderId,
  supplierOrders,
  supplierOrdersQueue,
  onIssueWithoutPayment,
  onPaySupplierOrder,
  onSelectedSupplierOrderChange,
}: AccountingSupplierOrdersQueueProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [cashboxByOrderId, setCashboxByOrderId] = useState<Record<string, string>>(
    {},
  );
  const [orderToPay, setOrderToPay] = useState<SupplierOrderPaymentQueueItem | null>(
    null,
  );

  const getRowCashboxId = (orderId: string) =>
    cashboxByOrderId[orderId] || firstCashboxId;

  const visibleOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return supplierOrdersQueue;
    return supplierOrdersQueue.filter((order) => {
      const number = getSupplierOrderDisplayNumber(order).toLowerCase();
      return (
        number.includes(query) ||
        order.supplierName.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, supplierOrdersQueue]);

  return (
    <section className='finance-orders-view'>
      <div className='finance-information-header finance-orders-header'>
        <div>
          <p className='section-label'>
            {t('accounting.orders.sectionLabel')}
          </p>
          <h2>{t('accounting.orders.title')}</h2>
        </div>
        <div className='finance-information-status'>
          <span>
            {t('accounting.orders.waitingStatus', {
              count: financeOverview.pendingSupplierCount,
            })}
          </span>
          <span>{formatMoney(financeOverview.pendingSupplierTotal, 'UAH')}</span>
        </div>
      </div>

      <div className='finance-orders-summary-grid'>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('accounting.orders.queueAmount')}
          </span>
          <strong>{formatMoney(financeOverview.pendingSupplierTotal, 'UAH')}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('accounting.orders.ordersWaiting')}
          </span>
          <strong>{formatMetric(financeOverview.pendingSupplierCount)}</strong>
        </article>
        <label className='field'>
          <span>{t('accounting.orders.search')}</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('accounting.orders.searchPlaceholder')}
          />
        </label>
      </div>

      <div className='orders-table-wrap finance-orders-table-wrap finance-card-table-wrap'>
        <table className='orders-table finance-orders-table'>
          <thead>
            <tr>
              <th className='finance-orders-col-number'>
                {t('accounting.orders.order')}
              </th>
              <th className='finance-orders-col-date'>
                {t('accounting.orders.date')}
              </th>
              <th className='finance-orders-col-supplier'>
                {t('common.supplier')}
              </th>
              <th className='finance-orders-col-amount'>
                {t('accounting.orders.amount')}
              </th>
              <th className='finance-orders-col-payment'>
                {t('accounting.orders.payment')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className='orders-empty finance-orders-empty'>
                  {t('accounting.orders.empty')}
                </td>
              </tr>
            ) : (
              visibleOrders.map((order) => {
                const cashboxId = getRowCashboxId(order.id);
                const orderNumber = getSupplierOrderDisplayNumber(order);
                const fullOrder = findSupplierOrderForQueueItem(
                  order,
                  supplierOrders,
                );
                return (
                  <tr key={order.id} className='finance-orders-row'>
                    <td
                      className='finance-orders-number-cell'
                      title={orderNumber}
                      data-label={t('accounting.orders.order')}
                    >
                      <button
                        type='button'
                        className='finance-orders-number-button'
                        onClick={() => {
                          if (fullOrder) {
                            onSelectedSupplierOrderChange(fullOrder);
                          }
                        }}
                        disabled={!fullOrder}
                        aria-label={t(
                          'accounting.orders.openSupplierOrderAriaLabel',
                          { orderNumber },
                        )}
                      >
                        {orderNumber}
                      </button>
                      <span className='finance-orders-cell-note'>
                        {t('accounting.orders.supplierOrder')}
                      </span>
                    </td>
                    <td
                      className='finance-orders-date-cell'
                      data-label={t('accounting.orders.date')}
                    >
                      <span>
                        {formatDateDdMmYyyy(order.deliveryDate || order.createdAt)}
                      </span>
                      <small>
                        {order.deliveryDate
                          ? t('accounting.orders.delivery')
                          : t('accounting.orders.created')}
                      </small>
                    </td>
                    <td
                      className='finance-orders-supplier-cell'
                      data-label={t('common.supplier')}
                    >
                      <TruncatedTextTooltip
                        text={order.supplierName}
                        className='orders-table-cell-truncate'
                      />
                      <small>{t('accounting.orders.paymentRequired')}</small>
                    </td>
                    <td
                      className='finance-orders-amount-cell'
                      data-label={t('accounting.orders.amount')}
                    >
                      <strong>{formatMoney(order.total, 'UAH')}</strong>
                    </td>
                    <td
                      className='finance-orders-payment-cell'
                      data-label={t('accounting.orders.payment')}
                    >
                      <div className='finance-orders-payment-actions'>
                        {canPaySupplierOrders ? (
                          <>
                            <label className='finance-orders-cashbox-select'>
                              <span>{t('accounting.orders.cashbox')}</span>
                              <select
                                value={cashboxId}
                                onChange={(event) =>
                                  setCashboxByOrderId((current) => ({
                                    ...current,
                                    [order.id]: event.target.value,
                                  }))
                                }
                              >
                                {cashboxes
                                  .filter(
                                    (cashbox) =>
                                      cashbox.enabledCurrencies?.UAH === true ||
                                      (cashbox.balances.UAH ?? 0) > 0,
                                  )
                                  .map((cashbox) => (
                                  <option
                                    key={cashbox.id}
                                    value={cashbox.id}
                                    title={cashbox.name}
                                  >
                                    {cashbox.name} (
                                    {formatMoney(cashbox.balances.UAH ?? 0, 'UAH')})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type='button'
                              className='primary-button'
                              disabled={
                                isSaving ||
                                payingOrderId === order.id ||
                                !cashboxId
                              }
                              onClick={() => setOrderToPay(order)}
                            >
                              {payingOrderId === order.id
                                ? t('accounting.orders.paying')
                                : t('accounting.orders.pay')}
                            </button>
                          </>
                        ) : null}
                        {canIssueSupplierOrdersWithoutPayment ? (
                          <button
                            type='button'
                            className='secondary-button'
                            disabled={isSaving}
                            onClick={() => onIssueWithoutPayment(order)}
                          >
                            {t('accounting.orders.issueWithoutPayment')}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {orderToPay ? (
        <PaySupplierOrderModal
          isSaving={isSaving || payingOrderId === orderToPay.id}
          order={orderToPay}
          cashboxName={
            cashboxes.find((cashbox) => cashbox.id === getRowCashboxId(orderToPay.id))
              ?.name ?? '-'
          }
          cashboxBalance={
            cashboxes.find((cashbox) => cashbox.id === getRowCashboxId(orderToPay.id))
              ?.balances.UAH ?? 0
          }
          insufficient={
            (cashboxes.find((cashbox) => cashbox.id === getRowCashboxId(orderToPay.id))
              ?.balances.UAH ?? 0) < orderToPay.total
          }
          onClose={() => setOrderToPay(null)}
          onConfirm={() => {
            const cashboxId = getRowCashboxId(orderToPay.id);
            onPaySupplierOrder(
              orderToPay,
              cashboxId,
              getSupplierOrderDisplayNumber(orderToPay),
            );
            setOrderToPay(null);
          }}
        />
      ) : null}
    </section>
  );
};