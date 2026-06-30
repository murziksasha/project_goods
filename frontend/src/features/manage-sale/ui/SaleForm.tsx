import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Client } from '../../../entities/client/model/types';
import type { Product } from '../../../entities/product/model/types';
import type { ProductSalePriceTier } from '../../../entities/product/lib/sale-prices';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { ProductSalePriceField } from '../../../shared/ui/ProductSalePriceField';
import type { SaleFormValues } from '../../../entities/sale/model/types';
import {
  DEBOUNCE_MS,
  MAX_SUGGESTIONS,
  getDefaultSalePrice,
  getProductLabel,
  normalizeDigits,
  normalizeText,
} from '../lib/sale-form';
import { ClientLookupFields } from './ClientLookupFields';
import { ProductLookupField } from './ProductLookupField';

type SaleFormProps = {
  clients: Client[];
  products: Product[];
  form: SaleFormValues;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof SaleFormValues>(
    field: K,
    value: SaleFormValues[K],
  ) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
};

export const SaleForm = ({
  clients,
  products,
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onCancelEdit,
}: SaleFormProps) => {
  const { t } = useTranslation();
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientPhoneInput, setClientPhoneInput] = useState('');
  const [productInput, setProductInput] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<Product[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [priceTier, setPriceTier] = useState<ProductSalePriceTier | null>(null);
  const previousProductIdRef = useRef(form.productId);

  const selectedClient = clients.find((client) => client.id === form.clientId) ?? null;
  const selectedProduct = products.find((product) => product.id === form.productId) ?? null;
  const displayedClientNameInput =
    form.clientId && selectedClient ? selectedClient.name : clientNameInput;
  const displayedClientPhoneInput =
    form.clientId && selectedClient ? selectedClient.phone : clientPhoneInput;
  const displayedProductInput =
    form.productId && selectedProduct ? getProductLabel(selectedProduct) : productInput;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const normalizedName = normalizeText(displayedClientNameInput);
      const normalizedPhone = normalizeDigits(displayedClientPhoneInput);

      setClientSuggestions(
        clients
          .filter((client) => {
            const matchesName =
              !normalizedName || client.name.toLowerCase().includes(normalizedName);
            const matchesPhone =
              !normalizedPhone ||
              normalizeDigits(client.phone).includes(normalizedPhone);

            return matchesName && matchesPhone;
          })
          .slice(0, MAX_SUGGESTIONS),
      );
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [clients, displayedClientNameInput, displayedClientPhoneInput]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const normalizedQuery = normalizeText(displayedProductInput);

      setProductSuggestions(
        products
          .filter((product) => {
            if (!normalizedQuery) {
              return true;
            }

            return [product.name, product.article, product.serialNumber, product.note]
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery);
          })
          .slice(0, MAX_SUGGESTIONS),
      );
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [displayedProductInput, products]);

  const handleClientPick = (client: Client) => {
    onChange('clientId', client.id);
    setClientNameInput(client.name);
    setClientPhoneInput(client.phone);
    setShowClientSuggestions(false);
  };

  const handleProductPick = (product: Product) => {
    onChange('productId', product.id);
    onChange('salePrice', String(getDefaultSalePrice(product)));
    onChange('note', product.note);
    setProductInput(getProductLabel(product));
    setPriceTier('retail');
    setShowProductSuggestions(false);
  };

  useEffect(() => {
    if (form.productId && form.productId !== previousProductIdRef.current) {
      setPriceTier('retail');
    }
    previousProductIdRef.current = form.productId;
  }, [form.productId]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="section-label">{t('legacy.saleForm.sectionLabel')}</p>
          <h2>
            {isEditing
              ? t('legacy.saleForm.editTitle')
              : t('legacy.saleForm.sellTitle')}
          </h2>
        </div>
        {isEditing ? (
          <button className="ghost-button" type="button" onClick={onCancelEdit}>
            {t('common.cancel')}
          </button>
        ) : null}
      </div>

      <div className="form-grid">
        <label className="field">
          <span>{t('legacy.saleForm.date')}</span>
          <input
            type="date"
            value={form.saleDate}
            onChange={(event) => onChange('saleDate', event.target.value)}
          />
        </label>

        <label className="field">
          <span>{t('legacy.saleForm.quantity')}</span>
          <NumberStepper
            min={1}
            value={form.quantity}
            onChange={(value) => onChange('quantity', value)}
          />
        </label>

        <ClientLookupFields
          clientNameInput={displayedClientNameInput}
          clientPhoneInput={displayedClientPhoneInput}
          clientSuggestions={clientSuggestions}
          showClientSuggestions={showClientSuggestions}
          onNameChange={(value) => {
            onChange('clientId', '');
            setClientNameInput(value);
            setShowClientSuggestions(true);
          }}
          onPhoneChange={(value) => {
            onChange('clientId', '');
            setClientPhoneInput(value);
            setShowClientSuggestions(true);
          }}
          onPickClient={handleClientPick}
          onShowSuggestions={() => setShowClientSuggestions(true)}
          onHideSuggestions={() => setShowClientSuggestions(false)}
        />

        <ProductLookupField
          productInput={displayedProductInput}
          productSuggestions={productSuggestions}
          showProductSuggestions={showProductSuggestions}
          onProductChange={(value) => {
            onChange('productId', '');
            setProductInput(value);
            setPriceTier(null);
            setShowProductSuggestions(true);
          }}
          onPickProduct={handleProductPick}
          onShowSuggestions={() => setShowProductSuggestions(true)}
          onHideSuggestions={() => setShowProductSuggestions(false)}
        />

        <ProductSalePriceField
          label={t('legacy.saleForm.salePrice')}
          fieldClassName="field sale-price-field-labeled"
          tierTogglePlacement="label"
          value={form.salePrice}
          onChange={(value) => onChange('salePrice', value)}
          product={selectedProduct}
          priceTier={priceTier}
          onPriceTierChange={setPriceTier}
          disabled={isSaving}
          ariaLabel={t('legacy.saleForm.salePrice')}
        />

        <label className="field field-wide">
          <span>{t('common.note')}</span>
          <textarea
            rows={4}
            value={form.note}
            placeholder={t('legacy.saleForm.notePlaceholder')}
            onChange={(event) => onChange('note', event.target.value)}
          />
        </label>
      </div>

      <button
        className="primary-button"
        type="button"
        onClick={onSubmit}
        disabled={
          isSaving ||
          !form.clientId ||
          !form.productId ||
          !form.quantity.trim() ||
          !form.salePrice.trim()
        }
      >
        {isSaving
          ? t('common.saving')
          : isEditing
            ? t('legacy.saleForm.updateSale')
            : t('legacy.saleForm.createSale')}
      </button>
    </section>
  );
};