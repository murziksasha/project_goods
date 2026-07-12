import { useTranslation } from 'react-i18next';
import type { Sale } from '../../../../../entities/sale/model/types';
import { isRepairOrder } from '../../../../../entities/sale/lib/sale-kind';
import type { Cashbox } from '../../../../../entities/finance/model/types';
import type { PrintForm } from '../../../../../entities/settings/model/types';
import { formatCurrency } from '../../../../../shared/lib/format';
import { parseDecimal } from '../../../../../shared/lib/decimal';
import {
  PRICE_STEPPER_PRECISION,
  PRICE_STEPPER_STEP,
} from '../../../../../shared/lib/price-stepper';
import { NumberStepper } from '../../../../../shared/ui/NumberStepper';
import { Modal } from '../../../../../shared/ui/Modal';
import { Button } from '../../../../../shared/ui/Button';
import {
  defaultPrintForms,
  normalizePrintFormsForView,
} from '../../../../../entities/settings/model/printForms';

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
  const { t } = useTranslation();
  const numericAmount = parseDecimal(amount);
  const nextPaymentRemaining = Math.max(
    currentPaymentRemaining -
      (Number.isFinite(numericAmount) ? numericAmount : 0),
    0,
  );
  const submitWithStatusLabel =
    paymentTargetStatus === 'paid'
      ? t('orders.payment.acceptAndMarkPaid')
      : t('orders.payment.acceptAndIssue');
  const submitWithoutPaymentLabel =
    paymentTargetStatus === 'paid'
      ? t('orders.payment.markPaidWithoutPayment')
      : t('orders.payment.issueWithoutPayment');
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
    <Modal
      isOpen
      title={t('orders.payment.acceptPayment')}
      onClose={onClose}
      closeLabel={t('orders.payment.closePayment')}
      shellClassName="payment-modal modal-dialog"
      bodyClassName="payment-modal-body"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="payment-modal-footer">
          <button
            type="button"
            className="secondary-button print-action-button"
            onClick={onOpenPrint}
            disabled={isSaving || !hasAvailablePrintForms}
          >
            <PrinterIcon />
            {t('orders.payment.print')}
          </button>
          <div className="payment-modal-actions">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              {t('orders.payment.cancel')}
            </Button>
            <button
              type="button"
              className="orders-create-button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSubmit('deposit');
              }}
              disabled={isSubmitDisabled}
            >
              {isSaving
                ? t('orders.payment.saving')
                : t('orders.payment.acceptToCashbox')}
            </button>
            <button
              type="button"
              className="payment-issue-button"
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
                  ? t('orders.payment.stockLocked')
                  : undefined
              }
            >
              {submitWithStatusLabel}
            </button>
            <button
              type="button"
              className="payment-issue-secondary-button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSubmit('issueWithoutPayment');
              }}
              disabled={isIssueDisabled}
              title={
                isIssueWithoutPaymentBlocked
                  ? isRepairTargetStatusBlockedByStock
                    ? t('orders.payment.stockLocked')
                    : isRepairOrder(sale)
                      ? t('orders.payment.repairProductsNeedFullPayment')
                      : t('orders.payment.issuedRequiresPayment')
                  : undefined
              }
            >
              {submitWithoutPaymentLabel}
            </button>
          </div>
        </footer>
      }
    >
      <div className="payment-modal-summary">
        <dl>
          <div>
            <dt>{t('orders.payment.repairCost')}</dt>
            <dd>{formatCurrency(total)}</dd>
          </div>
          <div>
            <dt>{t('orders.payment.paid')}</dt>
            <dd>{formatCurrency(paidAmount)}</dd>
          </div>
          <div>
            <dt>
              <span className="payment-summary-discount-label">
                {t('orders.payment.discount')}
                <span className="payment-summary-discount-badge">
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
            <dt>{t('orders.payment.toPay')}</dt>
            <dd>{formatCurrency(currentPaymentRemaining)}</dd>
          </div>
        </dl>
        <button
          type="button"
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
          {paymentMethod === 'cash'
            ? t('orders.payment.cash')
            : t('orders.payment.nonCash')}
        </button>
      </div>

      <div className="payment-modal-form">
        <label className="field payment-cashbox-field">
          <span>* {t('orders.payment.cashbox')}</span>
          <select
            value={selectedCashboxId}
            onChange={(event) => onCashboxChange(event.target.value)}
            disabled={isLoading || isSaving}
          >
            {cashboxes.map((cashbox) => (
              <option key={cashbox.id} value={cashbox.id}>
                {cashbox.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('orders.payment.amount')}</span>
          <NumberStepper
            min={0}
            max={currentPaymentRemaining}
            step={PRICE_STEPPER_STEP}
            precision={PRICE_STEPPER_PRECISION}
            value={amount}
            onChange={onAmountChange}
            disabled={isLoading || isSaving}
          />
        </label>
        <label className="field">
          <span>{t('orders.payment.toPay')}</span>
          <input value={String(nextPaymentRemaining)} disabled readOnly />
        </label>
      </div>
    </Modal>
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
  const { t } = useTranslation();
  const numericAmount = parseDecimal(amount);
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !selectedCashboxId ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    numericAmount > paidAmount;

  return (
    <Modal
      isOpen
      title={t('orders.payment.refundTitle')}
      onClose={onClose}
      closeLabel={t('orders.payment.closeRefund')}
      shellClassName="payment-modal modal-dialog"
      bodyClassName="payment-modal-body"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="payment-modal-footer">
          <div />
          <div className="payment-modal-actions">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              {t('orders.payment.cancel')}
            </Button>
            <button
              type="button"
              className="payment-issue-secondary-button"
              onClick={onSubmit}
              disabled={isSubmitDisabled}
            >
              {isSaving
                ? t('orders.payment.saving')
                : t('orders.payment.refundToClient')}
            </button>
          </div>
        </footer>
      }
    >
      <div className="payment-modal-summary">
        <dl>
          <div>
            <dt>{t('orders.payment.orderTotal')}</dt>
            <dd>{formatCurrency(total)}</dd>
          </div>
          <div>
            <dt>{t('orders.payment.paid')}</dt>
            <dd>{formatCurrency(paidAmount)}</dd>
          </div>
          <div>
            <dt>{t('orders.payment.refundAmount')}</dt>
            <dd>
              {formatCurrency(
                Number.isFinite(numericAmount) ? numericAmount : 0,
              )}
            </dd>
          </div>
        </dl>
        <span className="payment-cash-badge">
          {t('orders.payment.refundBadge')}
        </span>
      </div>

      <div className="payment-modal-form">
        <label className="field payment-cashbox-field">
          <span>* {t('orders.payment.cashbox')}</span>
          <select
            value={selectedCashboxId}
            onChange={(event) => onCashboxChange(event.target.value)}
            disabled={isLoading || isSaving}
          >
            {cashboxes.map((cashbox) => (
              <option key={cashbox.id} value={cashbox.id}>
                {cashbox.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('orders.payment.amount')}</span>
          <NumberStepper
            min={0}
            max={paidAmount}
            step={PRICE_STEPPER_STEP}
            precision={PRICE_STEPPER_PRECISION}
            value={amount}
            onChange={onAmountChange}
            disabled={isLoading || isSaving}
          />
        </label>
        <label className="field">
          <span>{t('orders.payment.available')}</span>
          <input value={String(paidAmount)} disabled readOnly />
        </label>
      </div>
    </Modal>
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
  const { t } = useTranslation();
  const productItems = lineItems.filter(
    (item) => item.kind === 'product',
  );
  const serviceItems = lineItems.filter(
    (item) => item.kind !== 'product',
  );
  const productTotal = getLineItemsTotal(productItems);
  const serviceTotal = getLineItemsTotal(serviceItems);
  const numericAmount = parseDecimal(amount);
  const minRefund = Math.max(paidAmount - serviceTotal, 0);
  const maxRefund = Math.min(productTotal, paidAmount);
  const suggestedCashboxName =
    cashboxes.find((cashbox) => cashbox.id === selectedCashboxId)
      ?.name ?? t('orders.payment.cashbox');
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
    <Modal
      isOpen
      title={t('orders.payment.returnSale')}
      onClose={onClose}
      closeLabel={t('orders.payment.closeReturn')}
      shellClassName="payment-modal modal-dialog"
      bodyClassName="payment-modal-body"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="payment-modal-footer">
          <p className="muted-copy">
            {t('orders.payment.suggestedCashbox', {
              name: suggestedCashboxName,
            })}
          </p>
          <div className="payment-modal-actions">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              {t('orders.payment.cancel')}
            </Button>
            <button
              type="button"
              className="payment-issue-secondary-button"
              onClick={onSubmit}
              disabled={isSubmitDisabled}
            >
              {isSaving
                ? t('orders.payment.saving')
                : t('orders.payment.returnSaleButton')}
            </button>
          </div>
        </footer>
      }
    >
      <div className="payment-modal-summary">
        <dl>
          <div>
            <dt>{t('orders.payment.order')}</dt>
            <dd>{sale.recordNumber ?? 'r------'}</dd>
          </div>
          <div>
            <dt>{t('orders.payment.productsToStock')}</dt>
            <dd>
              {productItems
                .map((item) => `${item.name} x${item.quantity}`)
                .join(', ')}
            </dd>
          </div>
          <div>
            <dt>{t('orders.payment.productTotal')}</dt>
            <dd>{formatCurrency(productTotal)}</dd>
          </div>
          <div>
            <dt>{t('orders.payment.paid')}</dt>
            <dd>{formatCurrency(paidAmount)}</dd>
          </div>
        </dl>
        <span className="payment-cash-badge">
          {t('orders.payment.returnBadge')}
        </span>
      </div>

      <div className="payment-modal-form">
        <label className="field">
          <span>{t('orders.payment.receiveToWarehouse')}</span>
          <input
            value={warehouse}
            onChange={(event) => onWarehouseChange(event.target.value)}
            disabled={isLoading || isSaving}
          />
        </label>
        <label className="field payment-cashbox-field">
          <span>{t('orders.payment.refundFromCashbox')}</span>
          <select
            value={selectedCashboxId}
            onChange={(event) => onCashboxChange(event.target.value)}
            disabled={isLoading || isSaving}
          >
            {cashboxes.map((cashbox) => (
              <option key={cashbox.id} value={cashbox.id}>
                {cashbox.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('orders.payment.refundAmount')}</span>
          <NumberStepper
            min={minRefund}
            max={maxRefund}
            step={PRICE_STEPPER_STEP}
            precision={PRICE_STEPPER_PRECISION}
            value={amount}
            onChange={onAmountChange}
            disabled={isLoading || isSaving}
          />
        </label>
      </div>
    </Modal>
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
  const { t } = useTranslation();
  const itemTotal = item.price * item.quantity;
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !warehouse.trim();

  return (
    <Modal
      isOpen
      title={t('orders.payment.returnProduct')}
      onClose={onClose}
      closeLabel={t('orders.payment.closeReturn')}
      shellClassName="payment-modal modal-dialog"
      bodyClassName="payment-modal-body"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="payment-modal-footer">
          <p className="muted-copy">
            {t('orders.payment.refundBeforeReturn')}
          </p>
          <div className="payment-modal-actions">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              {t('orders.payment.cancel')}
            </Button>
            <button
              type="button"
              className="payment-issue-secondary-button"
              onClick={onSubmit}
              disabled={isSubmitDisabled}
            >
              {isSaving
                ? t('orders.payment.saving')
                : t('orders.payment.returnProduct')}
            </button>
          </div>
        </footer>
      }
    >
      <div className="payment-modal-summary">
        <dl>
          <div>
            <dt>{t('orders.payment.product')}</dt>
            <dd>{item.name}</dd>
          </div>
          <div>
            <dt>{t('orders.payment.order')}</dt>
            <dd>{sale.recordNumber ?? 'r------'}</dd>
          </div>
          <div>
            <dt>{t('orders.payment.itemTotal')}</dt>
            <dd>{formatCurrency(itemTotal)}</dd>
          </div>
        </dl>
        <span className="payment-cash-badge">
          {t('orders.payment.returnBadge')}
        </span>
      </div>

      <div className="payment-modal-form">
        <label className="field">
          <span>{t('orders.payment.receiveToWarehouse')}</span>
          <input
            value={warehouse}
            onChange={(event) => onWarehouseChange(event.target.value)}
            disabled={isLoading || isSaving}
          />
        </label>
      </div>
    </Modal>
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
}: MessageModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen
      title={title}
      onClose={onClose}
      closeLabel={t('common.close')}
      shellClassName="payment-modal payment-modal-message modal-dialog"
      bodyClassName="payment-modal-body"
      footer={
        <footer className="payment-modal-footer">
          <div />
          <div className="payment-modal-actions">
            <Button variant="primary" onClick={onClose}>
              {t('common.ok')}
            </Button>
          </div>
        </footer>
      }
    >
      <p>{message}</p>
    </Modal>
  );
};
