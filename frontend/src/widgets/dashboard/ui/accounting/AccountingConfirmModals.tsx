import { useTranslation } from 'react-i18next';
import type {
  FinanceTransaction,
  FinanceTransactionType,
  SupplierOrderPaymentQueueItem,
} from '../../../../entities/finance/model/types';
import {
  formatDateDdMmYyyy,
  formatMoney,
} from '../../model/accounting';
import { getSupplierOrderDisplayNumber } from '../../model/supplier-order-utils';
import { Modal } from '../../../../shared/ui/Modal';
import { Button } from '../../../../shared/ui/Button';

type CancelTransactionModalProps = {
  isSaving: boolean;
  transaction: FinanceTransaction;
  onClose: () => void;
  onConfirm: () => void;
};

const cancelModalTitleKey: Record<FinanceTransactionType, string> = {
  deposit: 'accounting.confirmModals.cancelDepositTitle',
  withdraw: 'accounting.confirmModals.cancelWithdrawTitle',
  transfer: 'accounting.confirmModals.cancelTransferTitle',
};

const cancelModalDescriptionKey: Record<FinanceTransactionType, string> = {
  deposit: 'accounting.confirmModals.cancelDepositDescription',
  withdraw: 'accounting.confirmModals.cancelWithdrawDescription',
  transfer: 'accounting.confirmModals.cancelTransferDescription',
};

export const CancelTransactionModal = ({
  isSaving,
  transaction,
  onClose,
  onConfirm,
}: CancelTransactionModalProps) => {
  const { t } = useTranslation();
  const type = transaction.type;

  return (
    <Modal
      isOpen
      title={t(cancelModalTitleKey[type])}
      onClose={onClose}
      closeLabel={t('common.close')}
      className="finance-cancel-transfer-modal"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <Button variant="secondary" disabled={isSaving} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            className="finance-danger-button"
            disabled={isSaving}
            onClick={onConfirm}
          >
            {isSaving
              ? t('accounting.confirmModals.cancelling')
              : t('accounting.confirmModals.confirmCancellation')}
          </Button>
        </footer>
      }
    >
      <p>
        {t(cancelModalDescriptionKey[type], {
          toCashbox: transaction.toCashbox?.name ?? '-',
          fromCashbox: transaction.fromCashbox?.name ?? '-',
        })}
      </p>
      <div className="finance-cancel-transfer-summary">
        <span>{t('accounting.confirmModals.date')}</span>
        <strong>{formatDateDdMmYyyy(transaction.transactionDate)}</strong>
        <span>{t('accounting.confirmModals.amount')}</span>
        <strong>{formatMoney(transaction.amount, transaction.currency)}</strong>
        <span>{t('accounting.confirmModals.from')}</span>
        <strong>{transaction.fromCashbox?.name ?? '-'}</strong>
        <span>{t('accounting.confirmModals.to')}</span>
        <strong>{transaction.toCashbox?.name ?? '-'}</strong>
      </div>
      <p className="muted-copy">
        {t('accounting.confirmModals.cancelTransactionHistoryNote')}
      </p>
    </Modal>
  );
};

/** @deprecated Use CancelTransactionModal */
export const CancelTransferModal = CancelTransactionModal;

type IssueWithoutPaymentModalProps = {
  isSaving: boolean;
  order: SupplierOrderPaymentQueueItem;
  onClose: () => void;
  onConfirm: () => void;
};

export const IssueWithoutPaymentModal = ({
  isSaving,
  order,
  onClose,
  onConfirm,
}: IssueWithoutPaymentModalProps) => {
  const { t } = useTranslation();
  const orderNumber = getSupplierOrderDisplayNumber(order);

  return (
    <Modal
      isOpen
      title={t('accounting.confirmModals.issueWithoutPaymentTitle')}
      onClose={onClose}
      closeLabel={t('common.close')}
      className="finance-without-payment-modal"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={isSaving} onClick={onConfirm}>
            {t('accounting.confirmModals.confirm')}
          </Button>
        </footer>
      }
    >
      <p>
        {t('accounting.confirmModals.issueWithoutPaymentDescription', {
          orderNumber,
        })}
      </p>
      <p>{t('accounting.confirmModals.issueWithoutPaymentConfirm')}</p>
    </Modal>
  );
};
