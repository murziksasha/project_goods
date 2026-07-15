import { useTranslation } from 'react-i18next';
import type { Cashbox } from '../../../../../entities/finance/model/types';
import type { Sale } from '../../../../../entities/sale/model/types';
import type { PrintForm } from '../../../../../entities/settings/model/types';
import {
  MessageModal,
  PaymentModal,
  RefundModal,
  ReturnLineItemModal,
  ReturnSaleModal,
} from '../modals/OrderPaymentModals';
import { OrderPrintDialog } from '../modals/OrderPrintDialog';
import {
  getDiscount,
  getOrderBaseTotal,
  getOrderTotal,
  getRemainingPayment,
  isIssueWithoutPaymentBlockedForSale,
  isRepairStatusChangeLockedByStock,
  type OrderLineItem,
  type OrderPrintRequest,
  type PaymentAction,
  type PaymentMethod,
  type PaymentTargetStatus,
  type PrintCompanySettings,
} from './orders-workspace-shared';

type OrdersWorkspaceModalsProps = {
  printForms: PrintForm[];
  printCompanySettings: PrintCompanySettings;
  paymentSale: Sale | null;
  paymentTargetStatus: PaymentTargetStatus;
  cashboxes: Cashbox[];
  selectedCashboxId: string;
  paymentMethod: PaymentMethod;
  paymentAmount: string;
  isPaymentModalLoading: boolean;
  isPaymentSaving: boolean;
  refundSale: Sale | null;
  selectedRefundCashboxId: string;
  refundAmount: string;
  isRefundModalLoading: boolean;
  isRefundSaving: boolean;
  returnSale: Sale | null;
  returnLineItem: OrderLineItem | null;
  returnWarehouse: string;
  isReturnModalLoading: boolean;
  isReturnSaving: boolean;
  fullReturnSale: Sale | null;
  returnRefundAmount: string;
  isFullReturnModalLoading: boolean;
  isFullReturnSaving: boolean;
  printRequest: OrderPrintRequest | null;
  warningMessage: string | null;
  getLineItems: (sale: Sale) => OrderLineItem[];
  getPaidAmount: (sale: Sale) => number;
  onPaymentSaleClose: () => void;
  onRefundSaleClose: () => void;
  onReturnClose: () => void;
  onFullReturnClose: () => void;
  onPrintRequestClose: () => void;
  onWarningClose: () => void;
  onCashboxChange: (cashboxId: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onPaymentAmountChange: (amount: string) => void;
  onRefundCashboxChange: (cashboxId: string) => void;
  onRefundAmountChange: (amount: string) => void;
  onReturnWarehouseChange: (warehouse: string) => void;
  onReturnRefundAmountChange: (amount: string) => void;
  onOpenPrint: (sale: Sale, lineItems: OrderLineItem[], paidAmount: number) => void;
  onAcceptPayment: (action: PaymentAction) => void | Promise<void>;
  onRefundPayment: () => void | Promise<void>;
  onReturnLineItemToStock: () => void | Promise<void>;
  onReturnFullSaleToStock: () => void | Promise<void>;
};

export const OrdersWorkspaceModals = ({
  printForms,
  printCompanySettings,
  paymentSale,
  paymentTargetStatus,
  cashboxes,
  selectedCashboxId,
  paymentMethod,
  paymentAmount,
  isPaymentModalLoading,
  isPaymentSaving,
  refundSale,
  selectedRefundCashboxId,
  refundAmount,
  isRefundModalLoading,
  isRefundSaving,
  returnSale,
  returnLineItem,
  returnWarehouse,
  isReturnModalLoading,
  isReturnSaving,
  fullReturnSale,
  returnRefundAmount,
  isFullReturnModalLoading,
  isFullReturnSaving,
  printRequest,
  warningMessage,
  getLineItems,
  getPaidAmount,
  onPaymentSaleClose,
  onRefundSaleClose,
  onReturnClose,
  onFullReturnClose,
  onPrintRequestClose,
  onWarningClose,
  onCashboxChange,
  onPaymentMethodChange,
  onPaymentAmountChange,
  onRefundCashboxChange,
  onRefundAmountChange,
  onReturnWarehouseChange,
  onReturnRefundAmountChange,
  onOpenPrint,
  onAcceptPayment,
  onRefundPayment,
  onReturnLineItemToStock,
  onReturnFullSaleToStock,
}: OrdersWorkspaceModalsProps) => {
  const { t } = useTranslation();

  return (
    <>
      {paymentSale ? (
        <PaymentModal
          sale={paymentSale}
          paymentTargetStatus={paymentTargetStatus}
          printForms={printForms}
          cashboxes={cashboxes}
          selectedCashboxId={selectedCashboxId}
          paymentMethod={paymentMethod}
          amount={paymentAmount}
          paidAmount={getPaidAmount(paymentSale)}
          total={getOrderBaseTotal(paymentSale, getLineItems(paymentSale))}
          discount={getDiscount(paymentSale)}
          currentPaymentRemaining={getRemainingPayment(
            paymentSale,
            getPaidAmount(paymentSale),
            getLineItems(paymentSale),
          )}
          isRepairTargetStatusBlockedByStock={isRepairStatusChangeLockedByStock(
            paymentSale,
            paymentTargetStatus,
            getLineItems(paymentSale),
          )}
          isIssueWithoutPaymentBlocked={isIssueWithoutPaymentBlockedForSale(
            paymentSale,
            paymentTargetStatus,
            getLineItems(paymentSale),
            getRemainingPayment(
              paymentSale,
              getPaidAmount(paymentSale),
              getLineItems(paymentSale),
            ),
          )}
          isLoading={isPaymentModalLoading}
          isSaving={isPaymentSaving}
          onCashboxChange={onCashboxChange}
          onPaymentMethodChange={onPaymentMethodChange}
          onAmountChange={onPaymentAmountChange}
          onClose={onPaymentSaleClose}
          onOpenPrint={() =>
            onOpenPrint(
              paymentSale,
              getLineItems(paymentSale),
              getPaidAmount(paymentSale),
            )
          }
          onSubmit={onAcceptPayment}
        />
      ) : null}

      {printRequest ? (
        <OrderPrintDialog
          request={printRequest}
          printForms={printForms}
          companySettings={printCompanySettings}
          onClose={onPrintRequestClose}
        />
      ) : null}

      {refundSale ? (
        <RefundModal
          cashboxes={cashboxes}
          selectedCashboxId={selectedRefundCashboxId}
          amount={refundAmount}
          paidAmount={getPaidAmount(refundSale)}
          total={getOrderTotal(refundSale, getLineItems(refundSale))}
          isLoading={isRefundModalLoading}
          isSaving={isRefundSaving}
          onCashboxChange={onRefundCashboxChange}
          onAmountChange={onRefundAmountChange}
          onClose={onRefundSaleClose}
          onSubmit={onRefundPayment}
        />
      ) : null}

      {returnSale && returnLineItem ? (
        <ReturnLineItemModal
          sale={returnSale}
          item={returnLineItem}
          warehouse={returnWarehouse}
          isLoading={isReturnModalLoading}
          isSaving={isReturnSaving}
          onWarehouseChange={onReturnWarehouseChange}
          onClose={onReturnClose}
          onSubmit={onReturnLineItemToStock}
        />
      ) : null}

      {fullReturnSale ? (
        <ReturnSaleModal
          sale={fullReturnSale}
          lineItems={getLineItems(fullReturnSale)}
          cashboxes={cashboxes}
          selectedCashboxId={selectedRefundCashboxId}
          amount={returnRefundAmount}
          warehouse={returnWarehouse}
          paidAmount={getPaidAmount(fullReturnSale)}
          isLoading={isFullReturnModalLoading}
          isSaving={isFullReturnSaving}
          onCashboxChange={onRefundCashboxChange}
          onAmountChange={onReturnRefundAmountChange}
          onWarehouseChange={onReturnWarehouseChange}
          onClose={onFullReturnClose}
          onSubmit={onReturnFullSaleToStock}
        />
      ) : null}

      {warningMessage ? (
        <MessageModal
          title={t('orders.payment.warningTitle')}
          message={warningMessage}
          onClose={onWarningClose}
        />
      ) : null}
    </>
  );
};