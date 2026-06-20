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
          Cancel
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
          placeholder="WM-001"
          onChange={(event) => onChange('article', event.target.value)}
        />
      </label>

      <label className="field">
        <span>{t('product.serialNumber')}</span>
        <input
          value={form.serialNumber}
          placeholder="LOG-M185-0001"
          onChange={(event) => onChange('serialNumber', event.target.value)}
        />
      </label>

      <label className="field">
        <span>Price</span>
        <NumberStepper
          min={0}
          step={0.01}
          precision={2}
          value={form.price}
          placeholder="100"
          onChange={(value) => onChange('price', value)}
        />
      </label>

      <label className="field">
        <span>Sale prices</span>
        <input
          value={form.salePriceOptions}
          placeholder="649, 699, 749"
          onChange={(event) => onChange('salePriceOptions', event.target.value)}
        />
      </label>

      <label className="field">
        <span>Quantity</span>
        <NumberStepper
          min={0}
          value={form.quantity || "1"}
          placeholder="5"
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
          <option value="1">30 day</option>
          <option value="3">3 month</option>
          <option value="6">6 month</option>
          <option value="12">1 year</option>
          <option value="24">2 year</option>
          <option value="36">3 year</option>
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
