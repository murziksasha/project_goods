import type { ProductFormValues } from '../../../entities/product/model/types';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { useTranslation } from 'react-i18next';

type ProductFormProps = {
  form: ProductFormValues;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
};

const hasEmptyRequiredFields = (form: ProductFormValues) =>
  !form.name.trim() ||
  // !form.article.trim() ||
  // !form.serialNumber.trim() ||
  !form.price.trim() ||
  !form.quantity.trim();

export const ProductForm = ({
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onCancelEdit,
}: ProductFormProps) => {
  const { t } = useTranslation();
  return (
  <section className="panel">
    <div className="panel-header">
      <div>
        <p className="section-label">{isEditing ? t('common.edit') : t('common.create')}</p>
        <h2>{isEditing ? t('product.edit') : t('product.add')}</h2>
      </div>
      {isEditing ? (
        <button className="ghost-button" type="button" onClick={onCancelEdit}>
          {t('common.cancel')}
        </button>
      ) : null}
    </div>

    <div className="form-grid">
      <label className="field">
        <span>{t('product.name')}</span>
        <input
          value={form.name}
          placeholder={t('product.name')}
          onChange={(event) => onChange('name', event.target.value)}
        />
      </label>

      <label className="field">
        <span>{t('product.article')}</span>
        <input
          value={form.article}
          placeholder={t('product.examples.article')}
          onChange={(event) => onChange('article', event.target.value)}
        />
      </label>

      <label className="field">
        <span>{t('product.serialNumber')}</span>
        <input
          value={form.serialNumber}
          placeholder={t('product.examples.serialNumber')}
          onChange={(event) => onChange('serialNumber', event.target.value)}
        />
      </label>

      <label className="field">
        <span>{t('product.price')}</span>
        <NumberStepper
          min={0}
          step={0.01}
          precision={2}
          value={form.price}
          placeholder={t('product.examples.price')}
          onChange={(value) => onChange('price', value)}
        />
      </label>

      <label className="field">
        <span>{t('product.salePrices')}</span>
        <input
          value={form.salePriceOptions}
          placeholder={t('product.examples.salePriceOptions')}
          onChange={(event) => onChange('salePriceOptions', event.target.value)}
        />
      </label>

      <label className="field">
        <span>{t('product.quantity')}</span>
        <NumberStepper
          min={0}
          value={form.quantity || "1"}
          placeholder={t('product.examples.quantity')}
          onChange={(value) => onChange('quantity', value)}
        />
      </label>

      <label className="field">
        <span>{t('product.purchasePlace')}</span>
        <input
          value={form.purchasePlace}
          placeholder={t('product.purchasePlace')}
          onChange={(event) => onChange('purchasePlace', event.target.value)}
        />
      </label>

      <label className="field field-wide">
        <span>{t('product.defaultNote')}</span>
        <textarea
          rows={3}
          value={form.note}
          placeholder={t('product.defaultNote')}
          onChange={(event) => onChange('note', event.target.value)}
        />
      </label>

      <label className="field">
        <span>{t('product.purchaseDate')}</span>
        <input
          type="date"
          value={form.purchaseDate}
          onChange={(event) => onChange('purchaseDate', event.target.value)}
        />
      </label>

      <label className="field field-wide">
        <span>{t('product.warranty')}</span>
        <select
          value={form.warrantyPeriod}
          onChange={(event) => onChange('warrantyPeriod', event.target.value)}
        >
          <option value="">{t('product.selectWarranty')}</option>
          <option value="1">{t('orders.warranty.day30')}</option>
          <option value="3">{t('orders.warranty.month3')}</option>
          <option value="6">{t('orders.warranty.month6')}</option>
          <option value="12">{t('orders.warranty.year1')}</option>
          <option value="24">{t('orders.warranty.year2')}</option>
          <option value="36">{t('orders.warranty.year3')}</option>
        </select>
      </label>
    </div>

    <button
      className="primary-button"
      type="button"
      onClick={onSubmit}
      disabled={isSaving || hasEmptyRequiredFields(form)}
    >
      {isSaving ? t('product.saving') : isEditing ? t('product.update') : t('product.add')}
    </button>
  </section>
  );
};
