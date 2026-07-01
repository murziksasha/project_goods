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
    <div
      className='modal-backdrop'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        className='catalog-edit-modal finance-cancel-transfer-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='cancel-transaction-title'
      >
        <header className='catalog-edit-header'>
          <h2 id='cancel-transaction-title'>{t(cancelModalTitleKey[type])}</h2>
          <button
            type='button'
            className='ghost-button'
            disabled={isSaving}
            onClick={onClose}
          >
            &times;
          </button>
        </header>
        <div className='catalog-edit-body'>
          <p>
            {t(cancelModalDescriptionKey[type], {
              toCashbox: transaction.toCashbox?.name ?? '-',
              fromCashbox: transaction.fromCashbox?.name ?? '-',
            })}
          </p>
          <div className='finance-cancel-transfer-summary'>
            <span>{t('accounting.confirmModals.date')}</span>
            <strong>{formatDateDdMmYyyy(transaction.transactionDate)}</strong>
            <span>{t('accounting.confirmModals.amount')}</span>
            <strong>{formatMoney(transaction.amount, transaction.currency)}</strong>
            <span>{t('accounting.confirmModals.from')}</span>
            <strong>{transaction.fromCashbox?.name ?? '-'}</strong>
            <span>{t('accounting.confirmModals.to')}</span>
            <strong>{transaction.toCashbox?.name ?? '-'}</strong>
          </div>
          <p className='muted-copy'>
            {t('accounting.confirmModals.cancelTransactionHistoryNote')}
          </p>
        </div>
        <footer className='catalog-edit-footer'>
          <button
            type='button'
            className='secondary-button'
            disabled={isSaving}
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button
            type='button'
            className='primary-button finance-danger-button'
            disabled={isSaving}
            onClick={onConfirm}
          >
            {isSaving
              ? t('accounting.confirmModals.cancelling')
              : t('accounting.confirmModals.confirmCancellation')}
          </button>
        </footer>
      </div>
    </div>
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
    <div
      className='modal-backdrop'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className='catalog-edit-modal finance-without-payment-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='issue-without-payment-title'
      >
        <header className='catalog-edit-header'>
          <h2 id='issue-without-payment-title'>
            {t('accounting.confirmModals.issueWithoutPaymentTitle')}
          </h2>
          <button type='button' className='ghost-button' onClick={onClose}>
            &times;
          </button>
        </header>
        <div className='catalog-edit-body'>
          <p>
            {t('accounting.confirmModals.issueWithoutPaymentDescription', {
              orderNumber,
            })}
          </p>
          <p>{t('accounting.confirmModals.issueWithoutPaymentConfirm')}</p>
        </div>
        <footer className='catalog-edit-footer'>
          <button type='button' className='secondary-button' onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type='button'
            className='primary-button'
            disabled={isSaving}
            onClick={onConfirm}
          >
            {t('accounting.confirmModals.confirm')}
          </button>
        </footer>
      </div>
    </div>
  );
};