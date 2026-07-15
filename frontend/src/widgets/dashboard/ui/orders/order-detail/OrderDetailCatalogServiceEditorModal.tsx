import { useTranslation } from 'react-i18next';
import type { ServiceCatalogItem } from '../../../../../entities/service-catalog/model/types';
import { initialServiceCatalogForm } from '../../../../../entities/service-catalog/model/forms';
import {
  PRICE_STEPPER_PRECISION,
  PRICE_STEPPER_STEP,
} from '../../../../../shared/lib/price-stepper';
import { NumberStepper } from '../../../../../shared/ui/NumberStepper';
import { Modal } from '../../../../../shared/ui/Modal';
import { Button } from '../../../../../shared/ui/Button';

export type OrderDetailCatalogServiceEditorModalProps = {
  title: string;
  service?: ServiceCatalogItem;
  form: typeof initialServiceCatalogForm;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof typeof initialServiceCatalogForm>(
    field: K,
    value: (typeof initialServiceCatalogForm)[K],
  ) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export const OrderDetailCatalogServiceEditorModal = ({
  title,
  service,
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onClose,
}: OrderDetailCatalogServiceEditorModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen
      title={title}
      subtitle={
        service
          ? t('orders.detail.serviceEditor.service')
          : t('orders.detail.serviceEditor.newService')
      }
      onClose={onClose}
      closeLabel={t('orders.detail.close')}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <Button variant="secondary" onClick={onClose}>
            {t('orders.detail.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={isSaving || !isEditing}
          >
            {isSaving
              ? t('orders.payment.saving')
              : t('orders.detail.lineItems.save')}
          </Button>
        </footer>
      }
    >
      <h3>{t('orders.detail.mainInformation')}</h3>
      <label className="field">
        <span>{t('orders.detail.lineItems.name')}</span>
        <input
          value={form.name}
          onChange={(event) => onChange('name', event.target.value)}
        />
      </label>
      <fieldset className="catalog-type-field">
        <legend>{t('orders.detail.serviceEditor.itemType')}</legend>
        <label>
          <input type="radio" disabled />{' '}
          {t('orders.detail.serviceEditor.product')}
        </label>
        <label>
          <input type="radio" checked readOnly />{' '}
          {t('orders.detail.serviceEditor.service')}
        </label>
      </fieldset>
      <label className="field">
        <span>{t('orders.detail.serviceEditor.retailPrice')}</span>
        <NumberStepper
          min={0}
          step={PRICE_STEPPER_STEP}
          precision={PRICE_STEPPER_PRECISION}
          value={form.price}
          onChange={(value) => onChange('price', value)}
        />
      </label>
      <label className="field field-wide">
        <span>{t('orders.detail.serviceEditor.note')}</span>
        <textarea
          rows={3}
          value={form.note}
          onChange={(event) => onChange('note', event.target.value)}
        />
      </label>
    </Modal>
  );
};
