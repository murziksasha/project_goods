import type { Sale } from '../../../entities/sale/model/types';
import { isRepairOrder } from '../../../entities/sale/lib/sale-kind';
import type { Cashbox } from '../../../entities/finance/model/types';
import type { PrintForm } from '../../../entities/settings/model/types';
import { formatCurrency } from '../../../shared/lib/format';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import {
  defaultPrintForms,
  normalizePrintFormsForView,
} from '../../../entities/settings/model/printForms';

type PaymentAction =
  | 'deposit'
  | 'depositAndIssue'
  | 'issueWithoutPayment';
type PaymentTargetStatus =
  | 'issued'
  | 'issuedWithoutRepair'
  | 'paid';
type PaymentMethod = 'cash' | 'non-cash';
type OrderLineItem = {
  id: string;
  kind: 'product' | 'service';
  name: string;
  price: number;
  quantity: number;
  warrantyPeriod: number;
  serialNumbers?: string[];
};
type DiscountView = {
  mode: 'percent' | 'amount';
  value: number;
};

const PrinterIcon = () => (
  <svg
    className='print-button-icon'
    viewBox='0 0 24 24'
    aria-hidden='true'
    focusable='false'
  >
    <path
      d='M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2M7 14h10v7H7zM17 12h.01'
      fill='none'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
    />
  </svg>
);

const getLineItemsTotal = (lineItems: OrderLineItem[]) =>
  lineItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

type PaymentModalProps = {
  sale: Sale;
  paymentTargetStatus: PaymentTargetStatus;
  printForms: PrintForm[];
  cashboxes: Cashbox[];
  selectedCashboxId: string;
  paymentMethod: PaymentMethod;
  amount: string;
  paidAmount: number;
  total: number;
  discount: DiscountView;
  currentPaymentRemaining: number;
  isRepairTargetStatusBlockedByStock: boolean;
  isIssueWithoutPaymentBlocked: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onCashboxChange: (cashboxId: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onOpenPrint: () => void;
  onSubmit: (action: PaymentAction) => void;
};

export const PaymentModal = ({
  sale,
  paymentTargetStatus,
  printForms,
  cashboxes,
  selectedCashboxId,
  paymentMethod,
  amount,
  paidAmount,
  total,
  discount,
  currentPaymentRemaining,
  isRepairTargetStatusBlockedByStock,
  isIssueWithoutPaymentBlocked,
  isLoading,
  isSaving,
  onCashboxChange,
  onPaymentMethodChange,
  onAmountChange,
  onClose,
  onOpenPrint,
  onSubmit,
}: PaymentModalProps) => {
  const numericAmount = Number(amount);
  const nextPaymentRemaining = Math.max(
    currentPaymentRemaining -
      (Number.isFinite(numericAmount) ? numericAmount : 0),
    0,
  );
  const submitWithStatusLabel =
    paymentTargetStatus === 'paid'
      ? 'Accept and mark paid'
      : 'Accept and issue';
  const submitWithoutPaymentLabel =
    paymentTargetStatus === 'paid'
      ? 'Mark paid without payment'
      : 'Issue without payment';
  const hasAvailablePrintForms = normalizePrintFormsForView(
    printForms.length > 0 ? printForms : defaultPrintForms,
  ).some((form) => form.isActive);
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !selectedCashboxId ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    numericAmount > currentPaymentRemaining;
  const isIssueDisabled =
    isLoading || isSaving || isIssueWithoutPaymentBlocked;

  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='payment-modal'
        role='dialog'
        aria-modal='true'
        aria-label='Accept payment'
      >
        <button
          type='button'
          className='payment-modal-close'
          onClick={onClose}
          aria-label='Close payment modal'
        >
          &times;
        </button>

        <div className='payment-modal-summary'>
          <dl>
            <div>
              <dt>Repair cost</dt>
              <dd>{formatCurrency(total)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{formatCurrency(paidAmount)}</dd>
            </div>
            <div>
              <dt>
                <span className='payment-summary-discount-label'>
                  Discount
                  <span className='payment-summary-discount-badge'>
                    {discount.mode === 'percent' ? '%' : '₴'}
                  </span>
                </span>
              </dt>
              <dd>
                {discount.value > 0
                  ? `${discount.value}${discount.mode === 'percent' ? '%' : ' ₴'}`
                  : '-'}
              </dd>
            </div>
            <div>
              <dt>To pay</dt>
              <dd>{formatCurrency(currentPaymentRemaining)}</dd>
            </div>
          </dl>
          <button
            type='button'
            className={
              paymentMethod === 'non-cash'
                ? 'payment-cash-badge payment-cash-badge-non-cash'
                : 'payment-cash-badge'
            }
            onClick={() =>
              onPaymentMethodChange(
                paymentMethod === 'cash' ? 'non-cash' : 'cash',
              )
            }
            disabled={isLoading || isSaving}
          >
            {paymentMethod === 'cash' ? 'Cash' : 'Non-cash'}
          </button>
        </div>

        <div className='payment-modal-form'>
          <label className='field payment-cashbox-field'>
            <span>* Cashbox</span>
            <select
              value={selectedCashboxId}
              onChange={(event) =>
                onCashboxChange(event.target.value)
              }
              disabled={isLoading || isSaving}
            >
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>Amount</span>
            <NumberStepper
              min={0}
              max={currentPaymentRemaining}
              value={amount}
              onChange={onAmountChange}
              disabled={isLoading || isSaving}
            />
          </label>
          <label className='field'>
            <span>To pay</span>
            <input
              value={String(nextPaymentRemaining)}
              disabled
              readOnly
            />
          </label>
        </div>

        <footer className='payment-modal-footer'>
          <button
            type='button'
            className='secondary-button print-action-button'
            onClick={onOpenPrint}
            disabled={isSaving || !hasAvailablePrintForms}
          >
            <PrinterIcon />
            Print
          </button>
          <div className='payment-modal-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type='button'
              className='orders-create-button'
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSubmit('deposit');
              }}
              disabled={isSubmitDisabled}
            >
              {isSaving ? 'Saving...' : 'Accept to cashbox'}
            </button>
            <button
              type='button'
              className='payment-issue-button'
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSubmit('depositAndIssue');
              }}
              disabled={
                isSubmitDisabled || isRepairTargetStatusBlockedByStock
              }
              title={
                isRepairTargetStatusBlockedByStock
                  ? 'Refund client payment for bound products and return them to stock first.'
                  : undefined
              }
            >
              {submitWithStatusLabel}
            </button>
            <button
              type='button'
              className='payment-issue-secondary-button'
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSubmit('issueWithoutPayment');
              }}
              disabled={isIssueDisabled}
              title={
                isIssueWithoutPaymentBlocked
                  ? isRepairTargetStatusBlockedByStock
                    ? 'Refund client payment for bound products and return them to stock first.'
                    : isRepairOrder(sale)
                    ? 'Repair orders with products can be issued after full payment.'
                    : 'Issued sale requires payment to cashbox unless total is 0.'
                  : undefined
              }
            >
              {submitWithoutPaymentLabel}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

type RefundModalProps = {
  cashboxes: Cashbox[];
  selectedCashboxId: string;
  amount: string;
  paidAmount: number;
  total: number;
  isLoading: boolean;
  isSaving: boolean;
  onCashboxChange: (cashboxId: string) => void;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const RefundModal = ({
  cashboxes,
  selectedCashboxId,
  amount,
  paidAmount,
  total,
  isLoading,
  isSaving,
  onCashboxChange,
  onAmountChange,
  onClose,
  onSubmit,
}: RefundModalProps) => {
  const numericAmount = Number(amount);
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !selectedCashboxId ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    numericAmount > paidAmount;

  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='payment-modal'
        role='dialog'
        aria-modal='true'
        aria-label='Refund payment'
      >
        <button
          type='button'
          className='payment-modal-close'
          onClick={onClose}
          aria-label='Close refund modal'
        >
          &times;
        </button>

        <div className='payment-modal-summary'>
          <dl>
            <div>
              <dt>Order total</dt>
              <dd>{formatCurrency(total)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{formatCurrency(paidAmount)}</dd>
            </div>
            <div>
              <dt>Refund amount</dt>
              <dd>
                {formatCurrency(
                  Number.isFinite(numericAmount) ? numericAmount : 0,
                )}
              </dd>
            </div>
          </dl>
          <span className='payment-cash-badge'>Refund</span>
        </div>

        <div className='payment-modal-form'>
          <label className='field payment-cashbox-field'>
            <span>* Cashbox</span>
            <select
              value={selectedCashboxId}
              onChange={(event) =>
                onCashboxChange(event.target.value)
              }
              disabled={isLoading || isSaving}
            >
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>Amount</span>
            <NumberStepper
              min={0}
              max={paidAmount}
              value={amount}
              onChange={onAmountChange}
              disabled={isLoading || isSaving}
            />
          </label>
          <label className='field'>
            <span>Available</span>
            <input value={String(paidAmount)} disabled readOnly />
          </label>
        </div>

        <footer className='payment-modal-footer'>
          <div />
          <div className='payment-modal-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type='button'
              className='payment-issue-secondary-button'
              onClick={onSubmit}
              disabled={isSubmitDisabled}
            >
              {isSaving ? 'Saving...' : 'Refund to client'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

type ReturnLineItemModalProps = {
  sale: Sale;
  item: OrderLineItem;
  warehouse: string;
  isLoading: boolean;
  isSaving: boolean;
  onWarehouseChange: (warehouse: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

type ReturnSaleModalProps = {
  sale: Sale;
  lineItems: OrderLineItem[];
  cashboxes: Cashbox[];
  selectedCashboxId: string;
  amount: string;
  warehouse: string;
  paidAmount: number;
  isLoading: boolean;
  isSaving: boolean;
  onCashboxChange: (cashboxId: string) => void;
  onAmountChange: (amount: string) => void;
  onWarehouseChange: (warehouse: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const ReturnSaleModal = ({
  sale,
  lineItems,
  cashboxes,
  selectedCashboxId,
  amount,
  warehouse,
  paidAmount,
  isLoading,
  isSaving,
  onCashboxChange,
  onAmountChange,
  onWarehouseChange,
  onClose,
  onSubmit,
}: ReturnSaleModalProps) => {
  const productItems = lineItems.filter(
    (item) => item.kind === 'product',
  );
  const serviceItems = lineItems.filter(
    (item) => item.kind !== 'product',
  );
  const productTotal = getLineItemsTotal(productItems);
  const serviceTotal = getLineItemsTotal(serviceItems);
  const numericAmount = Number(amount);
  const minRefund = Math.max(paidAmount - serviceTotal, 0);
  const maxRefund = Math.min(productTotal, paidAmount);
  const suggestedCashboxName =
    cashboxes.find((cashbox) => cashbox.id === selectedCashboxId)
      ?.name ?? 'Cashbox';
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !selectedCashboxId ||
    !warehouse.trim() ||
    !Number.isFinite(numericAmount) ||
    numericAmount < minRefund ||
    numericAmount <= 0 ||
    numericAmount > maxRefund;

  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='payment-modal'
        role='dialog'
        aria-modal='true'
        aria-label='Return sale'
      >
        <button
          type='button'
          className='payment-modal-close'
          onClick={onClose}
          aria-label='Close return modal'
        >
          &times;
        </button>

        <div className='payment-modal-summary'>
          <dl>
            <div>
              <dt>Order</dt>
              <dd>{sale.recordNumber ?? 'r------'}</dd>
            </div>
            <div>
              <dt>Products to stock</dt>
              <dd>
                {productItems
                  .map((item) => `${item.name} x${item.quantity}`)
                  .join(', ')}
              </dd>
            </div>
            <div>
              <dt>Product total</dt>
              <dd>{formatCurrency(productTotal)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{formatCurrency(paidAmount)}</dd>
            </div>
          </dl>
          <span className='payment-cash-badge'>Return</span>
        </div>

        <div className='payment-modal-form'>
          <label className='field'>
            <span>Receive to warehouse</span>
            <input
              value={warehouse}
              onChange={(event) =>
                onWarehouseChange(event.target.value)
              }
              disabled={isLoading || isSaving}
            />
          </label>
          <label className='field payment-cashbox-field'>
            <span>Refund from cashbox</span>
            <select
              value={selectedCashboxId}
              onChange={(event) =>
                onCashboxChange(event.target.value)
              }
              disabled={isLoading || isSaving}
            >
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>Refund amount</span>
            <NumberStepper
              min={minRefund}
              max={maxRefund}
              value={amount}
              onChange={onAmountChange}
              disabled={isLoading || isSaving}
            />
          </label>
        </div>

        <footer className='payment-modal-footer'>
          <p className='muted-copy'>{`Suggested cashbox: ${suggestedCashboxName}`}</p>
          <div className='payment-modal-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type='button'
              className='payment-issue-secondary-button'
              onClick={onSubmit}
              disabled={isSubmitDisabled}
            >
              {isSaving ? 'Saving...' : 'Return sale'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export const ReturnLineItemModal = ({
  sale,
  item,
  warehouse,
  isLoading,
  isSaving,
  onWarehouseChange,
  onClose,
  onSubmit,
}: ReturnLineItemModalProps) => {
  const itemTotal = item.price * item.quantity;
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !warehouse.trim();

  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='payment-modal'
        role='dialog'
        aria-modal='true'
        aria-label='Return product'
      >
        <button
          type='button'
          className='payment-modal-close'
          onClick={onClose}
          aria-label='Close return modal'
        >
          &times;
        </button>

        <div className='payment-modal-summary'>
          <dl>
            <div>
              <dt>Product</dt>
              <dd>{item.name}</dd>
            </div>
            <div>
              <dt>Order</dt>
              <dd>{sale.recordNumber ?? 'r------'}</dd>
            </div>
            <div>
              <dt>Item total</dt>
              <dd>{formatCurrency(itemTotal)}</dd>
            </div>
          </dl>
          <span className='payment-cash-badge'>Return</span>
        </div>

        <div className='payment-modal-form'>
          <label className='field'>
            <span>Receive to warehouse</span>
            <input
              value={warehouse}
              onChange={(event) =>
                onWarehouseChange(event.target.value)
              }
              disabled={isLoading || isSaving}
            />
          </label>
        </div>

        <footer className='payment-modal-footer'>
          <p className='muted-copy'>
            Refund must be completed via "Refund to client" before stock return.
          </p>
          <div className='payment-modal-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type='button'
              className='payment-issue-secondary-button'
              onClick={onSubmit}
              disabled={isSubmitDisabled}
            >
              {isSaving ? 'Saving...' : 'Return product'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

type MessageModalProps = {
  title: string;
  message: string;
  onClose: () => void;
};

export const MessageModal = ({
  title,
  message,
  onClose,
}: MessageModalProps) => (
  <div className='modal-backdrop' role='presentation'>
    <section
      className='payment-modal payment-modal-message'
      role='dialog'
      aria-modal='true'
      aria-label={title}
    >
      <div className='payment-modal-summary'>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      <footer className='payment-modal-footer'>
        <div />
        <div className='payment-modal-actions'>
          <button
            type='button'
            className='primary-button'
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </footer>
    </section>
  </div>
);
