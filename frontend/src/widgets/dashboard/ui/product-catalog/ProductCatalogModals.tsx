import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientDevice, ClientDeviceFormValues } from '../../../../entities/client-device/model/types';
import type { CatalogProduct, CatalogProductFormValues } from '../../../../entities/catalog-product/model/types';
import type { Supplier, SupplierFormValues } from '../../../../entities/supplier/model/types';
import type { Product, ProductFormValues } from '../../../../entities/product/model/types';
import type { ServiceCatalogFormValues, ServiceCatalogItem } from '../../../../entities/service-catalog/model/types';
import { formatCurrency } from '../../../../shared/lib/format';
import { parseDecimal } from '../../../../shared/lib/decimal';
import {
  PRICE_STEPPER_PRECISION,
  PRICE_STEPPER_STEP,
} from '../../../../shared/lib/price-stepper';
import { NumberStepper } from '../../../../shared/ui/NumberStepper';
import { Modal } from '../../../../shared/ui/Modal';
import { Button } from '../../../../shared/ui/Button';
import {
  getPriceOption,
  getServicePriceOption,
  setPriceOption,
  setServicePriceOption,
} from './product-catalog-shared';
export const SupplierModal = ({
  supplier,
  onClose,
  onSave,
  onCreate,
}: {
  supplier: Supplier;
  onClose: () => void;
  onSave: (payload: SupplierFormValues) => Promise<void>;
  onCreate: (payload: SupplierFormValues) => Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(supplier.name);
  const [phone, setPhone] = useState(supplier.phone);
  const [note, setNote] = useState(supplier.note ?? '');
  const [isActive, setIsActive] = useState(supplier.isActive);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    await onSave({
      name: name.trim(),
      phone: phone.trim(),
      note: note.trim(),
      isActive,
    });
    setIsSaving(false);
  };

  const createCopy = async () => {
    if (!name.trim() || !phone.trim()) return;
    setIsSaving(true);
    const ok = await onCreate({
      name: `${name.trim()}${t('catalog.modals.supplierCopySuffix')}`,
      phone: phone.trim(),
      note: note.trim(),
      isActive,
    });
    setIsSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      isOpen
      title={t('catalog.modals.supplier')}
      subtitle={t('catalog.modals.supplierId', { id: supplier.id.slice(-6) })}
      onClose={onClose}
      closeLabel={t('catalog.modals.close')}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <Button variant="secondary" onClick={createCopy} disabled={isSaving}>
            {t('catalog.modals.addNew')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={isSaving || !name.trim() || !phone.trim()}
          >
            {isSaving ? t('catalog.modals.saving') : t('common.save')}
          </Button>
        </footer>
      }
    >
      <label className="field"><span>{t('catalog.modals.name')}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>{t('catalog.modals.phone')}</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="field field-wide"><span>{t('catalog.modals.note')}</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <label className="field"><span>{t('catalog.modals.status')}</span><select value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}><option value="active">{t('catalog.modals.active')}</option><option value="inactive">{t('catalog.modals.inactive')}</option></select></label>
    </Modal>
  );
};


type CatalogProductModalProps = {
  product: Product;
  catalogNumber: number;
  form: ProductFormValues;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
  onArchive: () => void;
  onActivate: () => void;
};

export const CatalogProductModal = ({
  product,
  catalogNumber,
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onClose,
  onArchive,
  onActivate,
}: CatalogProductModalProps) => {
  const { t } = useTranslation();

  const saveAndClose = async () => {
    await onSubmit();
    onClose();
  };

  return (
    <Modal
      isOpen
      title={product.name}
      subtitle={t('catalog.modals.supplierId', { id: catalogNumber || '-' })}
      onClose={onClose}
      closeLabel={t('catalog.modals.close')}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <button type="button" className="danger-button catalog-danger-wide" onClick={onArchive}>
            {t('catalog.modals.deleteDeactivate')}
          </button>
          <button
            type="button"
            className="primary-button catalog-activate-button"
            onClick={onActivate}
            disabled={isSaving || product.isActive}
          >
            {t('catalog.modals.activate')}
          </button>
          <Button variant="primary" onClick={() => void saveAndClose()} disabled={isSaving || !isEditing}>
            {isSaving ? t('catalog.modals.saving') : t('common.save')}
          </Button>
        </footer>
      }
    >
        <h3>{t('catalog.modals.mainInformation')}</h3>
        <label className="field">
          <span>{t('catalog.modals.name')}</span>
          <input value={form.name} onChange={(event) => onChange('name', event.target.value)} />
        </label>
        <label className="field">
          <span>{t('catalog.modals.article')}</span>
          <input value={form.article} onChange={(event) => onChange('article', event.target.value)} />
        </label>
        <label className="field">
          <span>{t('catalog.modals.serialNumber')}</span>
          <input value={form.serialNumber} onChange={(event) => onChange('serialNumber', event.target.value)} />
        </label>

        <fieldset className="catalog-type-field">
          <legend>{t('catalog.modals.itemType')}</legend>
          <label><input type="radio" checked readOnly /> {t('catalog.modals.itemTypeProduct')}</label>
          <label><input type="radio" disabled /> {t('catalog.modals.itemTypeService')}</label>
          <label><input type="radio" disabled /> {t('catalog.modals.itemTypeComplexProduct')}</label>
        </fieldset>

        <label className="field">
          <span>{t('catalog.modals.unit')}</span>
          <select value="pcs" disabled>
            <option value="pcs">{t('catalog.modals.unitDefault')}</option>
          </select>
        </label>

        <label className="field field-wide">
          <span>{t('catalog.modals.note')}</span>
          <textarea rows={3} value={form.note} onChange={(event) => onChange('note', event.target.value)} />
        </label>

        <div className="catalog-price-grid">
          <label className="field">
            <span>{t('catalog.modals.stockBalance')}</span>
            <input value={t('catalog.modals.stockBalanceValue', { free: product.freeQuantity, total: product.quantity })} disabled />
          </label>
          <label className="field">
            <span>{t('catalog.modals.retailPrice')}</span>
            <NumberStepper
              min={0}
step={PRICE_STEPPER_STEP}
              precision={PRICE_STEPPER_PRECISION}
              value={getPriceOption(form, 0) || form.price}
              onChange={(value) =>
                onChange('salePriceOptions', setPriceOption(form, 0, value))
              }
            />
          </label>
          <label className="field">
            <span>{t('catalog.modals.wholesalePrice1')}</span>
            <NumberStepper
              min={0}
step={PRICE_STEPPER_STEP}
              precision={PRICE_STEPPER_PRECISION}
              value={getPriceOption(form, 1)}
              onChange={(value) =>
                onChange('salePriceOptions', setPriceOption(form, 1, value))
              }
            />
          </label>
          <label className="field">
            <span>{t('catalog.modals.wholesalePrice2')}</span>
            <NumberStepper
              min={0}
step={PRICE_STEPPER_STEP}
              precision={PRICE_STEPPER_PRECISION}
              value={getPriceOption(form, 2)}
              onChange={(value) =>
                onChange('salePriceOptions', setPriceOption(form, 2, value))
              }
            />
          </label>
          <label className="field">
            <span>{t('catalog.modals.purchasePrice')}</span>
            <NumberStepper min={0} step={PRICE_STEPPER_STEP} precision={PRICE_STEPPER_PRECISION} value={form.price} onChange={(value) => onChange('price', value)} />
          </label>
          <label className="field">
            <span>{t('catalog.modals.warehouse')}</span>
            <input value={form.purchasePlace} onChange={(event) => onChange('purchasePlace', event.target.value)} />
          </label>
        </div>

        <div className="catalog-edit-summary">
          <p>{t('catalog.modals.retailSummary', { value: formatCurrency(parseDecimal(getPriceOption(form, 0) || form.price || product.price)) })}</p>
          <p>{t('catalog.modals.wholesale1Summary', { value: formatCurrency(parseDecimal(getPriceOption(form, 1) || 0)) })}</p>
          <p>{t('catalog.modals.wholesale2Summary', { value: formatCurrency(parseDecimal(getPriceOption(form, 2) || 0)) })}</p>
          <p>{t('catalog.modals.freeStockSummary', { count: product.freeQuantity })}</p>
          <p>{t('catalog.modals.totalStockSummary', { count: product.quantity })}</p>
        </div>
    </Modal>
  );
};

type CatalogServiceModalProps = {
  service: ServiceCatalogItem;
  catalogNumber: number;
  form: ServiceCatalogFormValues;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof ServiceCatalogFormValues>(
    field: K,
    value: ServiceCatalogFormValues[K],
  ) => void;
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
  onArchive: () => void;
  onActivate: () => void;
};

export const CatalogServiceModal = ({
  service,
  catalogNumber,
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onClose,
  onArchive,
  onActivate,
}: CatalogServiceModalProps) => {
  const { t } = useTranslation();

  const saveAndClose = async () => {
    await onSubmit();
    onClose();
  };

  return (
    <Modal
      isOpen
      title={service.name}
      subtitle={t('catalog.modals.supplierId', { id: catalogNumber || '-' })}
      onClose={onClose}
      closeLabel={t('catalog.modals.close')}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <button type="button" className="danger-button catalog-danger-wide" onClick={onArchive}>
            {t('catalog.modals.deleteDeactivate')}
          </button>
          <button
            type="button"
            className="primary-button catalog-activate-button"
            onClick={onActivate}
            disabled={isSaving || service.isActive}
          >
            {t('catalog.modals.activate')}
          </button>
          <Button variant="primary" onClick={() => void saveAndClose()} disabled={isSaving || !isEditing}>
            {isSaving ? t('catalog.modals.saving') : t('common.save')}
          </Button>
        </footer>
      }
    >
        <h3>{t('catalog.modals.mainInformation')}</h3>
        <label className="field">
          <span>{t('catalog.modals.name')}</span>
          <input value={form.name} onChange={(event) => onChange('name', event.target.value)} />
        </label>
        <fieldset className="catalog-type-field">
          <legend>{t('catalog.modals.itemType')}</legend>
          <label><input type="radio" disabled /> {t('catalog.modals.itemTypeProduct')}</label>
          <label><input type="radio" checked readOnly /> {t('catalog.modals.itemTypeService')}</label>
        </fieldset>
        <label className="field">
          <span>{t('catalog.modals.retailPrice')}</span>
          <NumberStepper min={0} step={PRICE_STEPPER_STEP} precision={PRICE_STEPPER_PRECISION} value={form.price} onChange={(value) => onChange('price', value)} />
        </label>
        <div className="catalog-price-grid">
          <label className="field">
            <span>{t('catalog.modals.wholesalePrice1')}</span>
            <NumberStepper
              min={0}
step={PRICE_STEPPER_STEP}
              precision={PRICE_STEPPER_PRECISION}
              value={getServicePriceOption(form, 0)}
              onChange={(value) =>
                onChange('salePriceOptions', setServicePriceOption(form, 0, value))
              }
            />
          </label>
          <label className="field">
            <span>{t('catalog.modals.wholesalePrice2')}</span>
            <NumberStepper
              min={0}
step={PRICE_STEPPER_STEP}
              precision={PRICE_STEPPER_PRECISION}
              value={getServicePriceOption(form, 1)}
              onChange={(value) =>
                onChange('salePriceOptions', setServicePriceOption(form, 1, value))
              }
            />
          </label>
        </div>
        <label className="field field-wide">
          <span>{t('catalog.modals.note')}</span>
          <textarea rows={3} value={form.note} onChange={(event) => onChange('note', event.target.value)} />
        </label>
        <div className="catalog-edit-summary">
          <p>{t('catalog.modals.retailSummary', { value: formatCurrency(parseDecimal(form.price || service.price)) })}</p>
          <p>{t('catalog.modals.wholesale1Summary', { value: formatCurrency(parseDecimal(getServicePriceOption(form, 0) || 0)) })}</p>
          <p>{t('catalog.modals.wholesale2Summary', { value: formatCurrency(parseDecimal(getServicePriceOption(form, 1) || 0)) })}</p>
          <p>{t('catalog.modals.statusSummary', { status: service.isActive ? t('catalog.modals.active') : t('catalog.modals.inactive') })}</p>
        </div>
    </Modal>
  );
};

export const ClientDeviceModal = ({
  device,
  onClose,
  onSave,
  onRemove,
}: {
  device: ClientDevice;
  onClose: () => void;
  onSave: (payload: ClientDeviceFormValues) => Promise<void>;
  onRemove: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(device.name);
  const [note, setNote] = useState(device.note);
  const [isActive, setIsActive] = useState(device.isActive);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    await onSave({
      clientId: device.clientId,
      clientName: device.clientName,
      clientPhone: device.clientPhone,
      name: name.trim(),
      serialNumber: '',
      note: note.trim(),
      source: device.source,
      isActive,
      expectedUpdatedAt: device.updatedAt,
    });
    setIsSaving(false);
  };

  return (
    <Modal
      isOpen
      title={t('catalog.modals.clientDevice')}
      onClose={onClose}
      closeLabel={t('catalog.modals.close')}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <button type="button" className="danger-button catalog-danger-wide" onClick={() => void onRemove()} disabled={!device.canRemove || isSaving}>
            {t('catalog.modals.remove')}
          </button>
          <Button variant="primary" onClick={() => void save()} disabled={isSaving || name.trim().length < 2}>
            {isSaving ? t('catalog.modals.saving') : t('common.save')}
          </Button>
        </footer>
      }
    >
      <label className="field"><span>{t('catalog.modals.name')}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field field-wide"><span>{t('catalog.modals.note')}</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <label className="field">
        <span>{t('catalog.modals.status')}</span>
        <select value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}>
          <option value="active">{t('catalog.modals.active')}</option>
          <option value="inactive">{t('catalog.modals.inactive')}</option>
        </select>
      </label>
    </Modal>
  );
};

export const CatalogSuggestionProductModal = ({
  product,
  onClose,
  onSave,
  onRemove,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onSave: (payload: CatalogProductFormValues) => Promise<void>;
  onRemove: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(product.name);
  const [note, setNote] = useState(product.note);
  const [isActive, setIsActive] = useState(product.isActive);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    await onSave({
      name: name.trim(),
      note: note.trim(),
      isActive,
    });
    setIsSaving(false);
  };

  return (
    <Modal
      isOpen
      title={t('catalog.modals.product')}
      onClose={onClose}
      closeLabel={t('catalog.modals.close')}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <button type="button" className="danger-button catalog-danger-wide" onClick={() => void onRemove()} disabled={product.canRemove === false || isSaving}>
            {t('catalog.modals.remove')}
          </button>
          <Button variant="primary" onClick={() => void save()} disabled={isSaving || name.trim().length < 2}>
            {isSaving ? t('catalog.modals.saving') : t('common.save')}
          </Button>
        </footer>
      }
    >
      <label className="field"><span>{t('catalog.modals.name')}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field field-wide"><span>{t('catalog.modals.note')}</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <label className="field">
        <span>{t('catalog.modals.status')}</span>
        <select value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}>
          <option value="active">{t('catalog.modals.active')}</option>
          <option value="inactive">{t('catalog.modals.inactive')}</option>
        </select>
      </label>
    </Modal>
  );
};