import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Cashbox } from '../../../../../entities/finance/model/types';
import type { SupplierOrder } from '../../../../../entities/supplier-order/model/types';
import { formatCurrency } from '../../../../../shared/lib/format';
import { Button } from '../../../../../shared/ui/Button';
import { Modal } from '../../../../../shared/ui/Modal';
import { getSupplierOrderDisplayNumber } from '../../../model/supplier-order-utils';

type SupplierOrderPayModalProps = {
  order: SupplierOrder;
  cashboxes: Cashbox[];
  isLoading: boolean;
  isSaving: boolean;
  canIssueWithoutPayment: boolean;
  onClose: () => void;
  onPay: (cashboxId: string) => void;
  onIssueWithoutPayment: () => void;
};

export const SupplierOrderPayModal = ({
  order,
  cashboxes,
  isLoading,
  isSaving,
  canIssueWithoutPayment,
  onClose,
  onPay,
  onIssueWithoutPayment,
}: SupplierOrderPayModalProps) => {
  const { t } = useTranslation();
  const orderNumber = getSupplierOrderDisplayNumber(order);
  const [selectedCashboxId, setSelectedCashboxId] = useState('');
  const [isConfirmingIssueWithoutPayment, setIsConfirmingIssueWithoutPayment] =
    useState(false);

  useEffect(() => {
    const defaultCashboxId =
      cashboxes.find((cashbox) => cashbox.isDefault)?.id ??
      cashboxes[0]?.id ??
      '';
    setSelectedCashboxId(defaultCashboxId);
  }, [cashboxes]);

  const isPayDisabled =
    isLoading || isSaving || !selectedCashboxId || cashboxes.length === 0;

  if (isConfirmingIssueWithoutPayment) {
    return (
      <Modal
        isOpen
        title={t('accounting.confirmModals.issueWithoutPaymentTitle')}
        onClose={onClose}
        closeLabel={t('common.close')}
        className='finance-without-payment-modal'
        closeOnBackdrop={!isSaving}
        closeOnEscape={!isSaving}
        footer={
          <footer className='catalog-edit-footer'>
            <Button
              variant='secondary'
              disabled={isSaving}
              onClick={() => setIsConfirmingIssueWithoutPayment(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant='primary'
              disabled={isSaving}
              onClick={onIssueWithoutPayment}
            >
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
  }

  return (
    <Modal
      isOpen
      title={t('orders.supplier.pay.modalTitle')}
      onClose={onClose}
      closeLabel={t('orders.supplier.pay.closeAriaLabel')}
      shellClassName='payment-modal modal-dialog supplier-order-pay-modal'
      bodyClassName='payment-modal-body'
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      initialFocusSelector='.payment-cashbox-field select'
      footer={
        <footer className='payment-modal-footer'>
          <div>
            {canIssueWithoutPayment ? (
              <Button
                variant='secondary'
                disabled={isLoading || isSaving}
                onClick={() => setIsConfirmingIssueWithoutPayment(true)}
              >
                {t('accounting.orders.issueWithoutPayment')}
              </Button>
            ) : null}
          </div>
          <div className='payment-modal-actions'>
            <Button variant='secondary' onClick={onClose} disabled={isSaving}>
              {t('orders.payment.cancel')}
            </Button>
            <button
              type='button'
              className='orders-create-button'
              disabled={isPayDisabled}
              onClick={() => onPay(selectedCashboxId)}
            >
              {isSaving
                ? t('accounting.orders.paying')
                : t('accounting.orders.pay')}
            </button>
          </div>
        </footer>
      }
    >
      <div className='payment-modal-summary'>
        <dl>
          <div>
            <dt>{t('accounting.orders.order')}</dt>
            <dd>{orderNumber}</dd>
          </div>
          <div>
            <dt>{t('common.supplier')}</dt>
            <dd>{order.supplierName || '-'}</dd>
          </div>
          <div>
            <dt>{t('accounting.orders.amount')}</dt>
            <dd>{formatCurrency(order.total)}</dd>
          </div>
        </dl>
      </div>
      <div className='payment-modal-form'>
        <label className='field payment-cashbox-field'>
          <span>* {t('orders.payment.cashbox')}</span>
          <select
            value={selectedCashboxId}
            onChange={(event) => setSelectedCashboxId(event.target.value)}
            disabled={isLoading || isSaving || cashboxes.length === 0}
          >
            {cashboxes.length === 0 && isLoading ? (
              <option value=''>
                {t('orders.supplier.table.loading')}
              </option>
            ) : null}
            {cashboxes.map((cashbox) => (
              <option key={cashbox.id} value={cashbox.id}>
                {cashbox.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Modal>
  );
};
