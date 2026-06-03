import type {
  FinanceTransaction,
  SupplierOrderPaymentQueueItem,
} from '../../../entities/finance/model/types';
import {
  formatDateDdMmYyyy,
  formatMoney,
} from '../model/accounting';
import { getSupplierOrderDisplayNumber } from '../model/supplier-order-utils';

type CancelTransferModalProps = {
  isSaving: boolean;
  transfer: FinanceTransaction;
  onClose: () => void;
  onConfirm: () => void;
};

export const CancelTransferModal = ({
  isSaving,
  transfer,
  onClose,
  onConfirm,
}: CancelTransferModalProps) => (
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
      aria-labelledby='cancel-transfer-title'
    >
      <header className='catalog-edit-header'>
        <h2 id='cancel-transfer-title'>Cancel transfer</h2>
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
          This will create a reverse transaction and return funds from{' '}
          <strong>{transfer.toCashbox?.name ?? '-'}</strong> to{' '}
          <strong>{transfer.fromCashbox?.name ?? '-'}</strong>.
        </p>
        <div className='finance-cancel-transfer-summary'>
          <span>Date</span>
          <strong>{formatDateDdMmYyyy(transfer.transactionDate)}</strong>
          <span>Amount</span>
          <strong>{formatMoney(transfer.amount, transfer.currency)}</strong>
          <span>From</span>
          <strong>{transfer.fromCashbox?.name ?? '-'}</strong>
          <span>To</span>
          <strong>{transfer.toCashbox?.name ?? '-'}</strong>
        </div>
        <p className='muted-copy'>
          The original transfer will stay in history with a Cancelled badge.
        </p>
      </div>
      <footer className='catalog-edit-footer'>
        <button
          type='button'
          className='secondary-button'
          disabled={isSaving}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type='button'
          className='primary-button finance-danger-button'
          disabled={isSaving}
          onClick={onConfirm}
        >
          {isSaving ? 'Cancelling...' : 'Confirm cancellation'}
        </button>
      </footer>
    </div>
  </div>
);

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
}: IssueWithoutPaymentModalProps) => (
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
        <h2 id='issue-without-payment-title'>Confirm issue without payment</h2>
        <button type='button' className='ghost-button' onClick={onClose}>
          &times;
        </button>
      </header>
      <div className='catalog-edit-body'>
        <p>
          Order <strong>{getSupplierOrderDisplayNumber(order)}</strong> will be
          marked as <strong>issued without payment</strong>.
        </p>
        <p>No finance transaction will be created. Continue?</p>
      </div>
      <footer className='catalog-edit-footer'>
        <button type='button' className='secondary-button' onClick={onClose}>
          Cancel
        </button>
        <button
          type='button'
          className='primary-button'
          disabled={isSaving}
          onClick={onConfirm}
        >
          Confirm
        </button>
      </footer>
    </div>
  </div>
);
