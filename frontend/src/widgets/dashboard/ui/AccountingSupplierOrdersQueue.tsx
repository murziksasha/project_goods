import type { Dispatch, SetStateAction } from 'react';
import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  SupplierOrderPaymentQueueItem,
} from '../../../entities/finance/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import {
  formatDateDdMmYyyy,
  formatMoney,
  truncateLabel,
  type FinanceOverview,
} from '../model/accounting';
import { formatMetric } from '../model/sales-analytics';
import { getSupplierOrderDisplayNumber } from '../model/supplier-order-utils';

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
}: AccountingSupplierOrdersQueueProps) => (
  <section className='finance-orders-view'>
    <div className='finance-information-header finance-orders-header'>
      <div>
        <p className='section-label'>Supplier payments</p>
        <h2>Orders payment queue</h2>
      </div>
      <div className='finance-information-status'>
        <span>{`${financeOverview.pendingSupplierCount} waiting`}</span>
        <span>{formatMoney(financeOverview.pendingSupplierTotal, 'UAH')}</span>
      </div>
    </div>

    <div className='finance-orders-summary-grid'>
      <article className='analytics-summary-card'>
        <span className='metric-label'>Queue amount</span>
        <strong>{formatMoney(financeOverview.pendingSupplierTotal, 'UAH')}</strong>
      </article>
      <article className='analytics-summary-card'>
        <span className='metric-label'>Orders waiting</span>
        <strong>{formatMetric(financeOverview.pendingSupplierCount)}</strong>
      </article>
      <article className='analytics-summary-card'>
        <span className='metric-label'>Active cashboxes</span>
        <strong>{formatMetric(financeOverview.activeCashboxCount)}</strong>
      </article>
    </div>

    <div className='orders-table-wrap finance-orders-table-wrap'>
      <table className='orders-table finance-orders-table'>
        <thead>
          <tr>
            <th className='finance-orders-col-number'>Order</th>
            <th className='finance-orders-col-date'>Date</th>
            <th className='finance-orders-col-supplier'>Supplier</th>
            <th className='finance-orders-col-amount'>Amount</th>
            <th className='finance-orders-col-payment'>Payment</th>
          </tr>
        </thead>
        <tbody>
          {supplierOrdersQueue.length === 0 ? (
            <tr>
              <td colSpan={5} className='orders-empty finance-orders-empty'>
                No orders are waiting for payment.
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
                  <td className='finance-orders-number-cell' title={orderNumber}>
                    <button
                      type='button'
                      className='finance-orders-number-button'
                      onClick={() => {
                        if (fullOrder) {
                          onSelectedSupplierOrderChange(fullOrder);
                        }
                      }}
                      disabled={!fullOrder}
                      aria-label={`Open supplier order ${orderNumber}`}
                    >
                      {orderNumber}
                    </button>
                    <span className='finance-orders-cell-note'>Supplier order</span>
                  </td>
                  <td className='finance-orders-date-cell'>
                    <span>
                      {formatDateDdMmYyyy(order.deliveryDate || order.createdAt)}
                    </span>
                    <small>{order.deliveryDate ? 'Delivery' : 'Created'}</small>
                  </td>
                  <td className='finance-orders-supplier-cell'>
                    <span className='orders-table-cell-truncate'>
                      {order.supplierName}
                    </span>
                    <small>Payment required</small>
                  </td>
                  <td className='finance-orders-amount-cell'>
                    <strong>{formatMoney(order.total, 'UAH')}</strong>
                  </td>
                  <td className='finance-orders-payment-cell'>
                    <div className='finance-orders-payment-actions'>
                      {canPaySupplierOrders ? (
                        <>
                          <label className='finance-orders-cashbox-select'>
                            <span>Cashbox</span>
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
                            Pay
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
                          Issue without payment
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
