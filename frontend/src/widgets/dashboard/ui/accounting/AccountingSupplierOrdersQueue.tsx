import { useTranslation } from 'react-i18next';
import type { Dispatch, SetStateAction } from 'react';
import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  SupplierOrderPaymentQueueItem,
} from '../../../../entities/finance/model/types';
import type { SupplierOrder } from '../../../../entities/supplier-order/model/types';
import {
  formatDateDdMmYyyy,
  formatMoney,
  truncateLabel,
  type FinanceOverview,
} from '../../model/accounting';
import { TruncatedTextTooltip } from '../../../../shared/ui/TruncatedTextTooltip';
import { formatMetric } from '../../model/sales-analytics';
import { getSupplierOrderDisplayNumber } from '../../model/supplier-order-utils';

type AccountingSupplierOrdersQueueProps = {
  canIssueSupplierOrdersWithoutPayment: boolean;
  canPaySupplierOrders: boolean;
  cashboxes: Cashbox[];
  financeOverview: FinanceOverview;
  firstCashboxId: string;
  isSaving: boolean;
  supplierOrders: SupplierOrder[];
  supplierOrdersQueue: SupplierOrderPaymentQueueItem[];
  transactionForm: CreateFinanceTransactionPayload;
  onIssueWithoutPayment: (order: SupplierOrderPaymentQueueItem) => void;
  onPaySupplierOrder: (
    order: SupplierOrderPaymentQueueItem,
    cashboxId: string,
    orderNumber: string,
  ) => void;
  onSelectedSupplierOrderChange: (order: SupplierOrder) => void;
  onTransactionFormChange: Dispatch<
    SetStateAction<CreateFinanceTransactionPayload>
  >;
};

export const AccountingSupplierOrdersQueue = ({
  canIssueSupplierOrdersWithoutPayment,
  canPaySupplierOrders,
  cashboxes,
  financeOverview,
  firstCashboxId,
  isSaving,
  supplierOrders,
  supplierOrdersQueue,
  transactionForm,
  onIssueWithoutPayment,
  onPaySupplierOrder,
  onSelectedSupplierOrderChange,
  onTransactionFormChange,
}: AccountingSupplierOrdersQueueProps) => {
  const { t } = useTranslation();

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
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('accounting.orders.activeCashboxes')}
          </span>
          <strong>{formatMetric(financeOverview.activeCashboxCount)}</strong>
        </article>
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
            {supplierOrdersQueue.length === 0 ? (
              <tr>
                <td colSpan={5} className='orders-empty finance-orders-empty'>
                  {t('accounting.orders.empty')}
                </td>
              </tr>
            ) : (
              supplierOrdersQueue.map((order) => {
                const cashboxId = transactionForm.fromCashboxId || firstCashboxId;
                const orderNumber = getSupplierOrderDisplayNumber(order);
                const fullOrder = supplierOrders.find(
                  (supplierOrder) =>
                    supplierOrder.id === order.id ||
                    supplierOrder.orderBaseId === order.orderBaseId ||
                    supplierOrder.number === order.number,
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
                                  onTransactionFormChange((current) => ({
                                    ...current,
                                    fromCashboxId: event.target.value,
                                  }))
                                }
                              >
                                {cashboxes.map((cashbox) => (
                                  <option
                                    key={cashbox.id}
                                    value={cashbox.id}
                                    title={cashbox.name}
                                  >
                                    {truncateLabel(cashbox.name, 14)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type='button'
                              className='primary-button'
                              disabled={isSaving || !cashboxId}
                              onClick={() =>
                                onPaySupplierOrder(order, cashboxId, orderNumber)
                              }
                            >
                              {t('accounting.orders.pay')}
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
    </section>
  );
};