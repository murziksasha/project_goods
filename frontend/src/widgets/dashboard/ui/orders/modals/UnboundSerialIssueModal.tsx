import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../../shared/ui/Modal';
import { Button } from '../../../../../shared/ui/Button';

type UnboundSerialIssueModalProps = {
  productNames: string[];
  onCancel: () => void;
  onContinue: () => void;
};

const WarningIcon = () => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
    <path
      d='M12 3.5 2.8 20.5h18.4L12 3.5z'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinejoin='round'
    />
    <path
      d='M12 9v5.5'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
    />
    <circle cx='12' cy='17.4' r='1' fill='currentColor' />
  </svg>
);

export const UnboundSerialIssueModal = ({
  productNames,
  onCancel,
  onContinue,
}: UnboundSerialIssueModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen
      role='alertdialog'
      title={t('orders.serialIssueWarning.title')}
      onClose={onCancel}
      closeLabel={t('orders.serialIssueWarning.closeAria')}
      shellClassName='catalog-edit-modal modal-dialog unbound-serial-issue-modal'
      footer={
        <footer className='catalog-edit-footer'>
          <Button variant='secondary' onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <button
            type='button'
            className='payment-issue-button'
            onClick={onContinue}
          >
            {t('orders.serialIssueWarning.continue')}
          </button>
        </footer>
      }
    >
      <div className='unbound-serial-issue-banner'>
        <WarningIcon />
        <p>{t('orders.serialIssueWarning.description')}</p>
      </div>
      {productNames.length > 0 ? (
        <ul className='unbound-serial-issue-products'>
          {productNames.map((name, index) => (
            <li key={`${name}-${index}`}>{name}</li>
          ))}
        </ul>
      ) : null}
    </Modal>
  );
};
