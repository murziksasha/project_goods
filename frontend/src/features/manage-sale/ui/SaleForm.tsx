import { useEffect, useId, useState } from 'react';
import type { Client } from '../../../entities/client/model/types';
import type { Product } from '../../../entities/product/model/types';
import type { SaleFormValues } from '../../../entities/sale/model/types';
import { formatCurrency } from '../../../shared/lib/format';
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
  const salePriceListId = useId();
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientPhoneInput, setClientPhoneInput] = useState('');
  const [productInput, setProductInput] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<Product[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

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
    setShowProductSuggestions(false);
  };

  const productSalePriceOptions = selectedProduct
    ? Array.from(
        new Set([
          getDefaultSalePrice(selectedProduct),
          ...selectedProduct.salePriceOptions,
        ]),
      )
    : [];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="section-label">Sales</p>
          <h2>{isEditing ? 'Edit sale' : 'Sell product'}</h2>
        </div>
        {isEditing ? (
          <button className="ghost-button" type="button" onClick={onCancelEdit}>
            Cancel
          </button>
        ) : null}
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={form.saleDate}
            onChange={(event) => onChange('saleDate', event.target.value)}
          />
        </label>

        <label className="field">
          <span>Quantity</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.quantity}
            onChange={(event) => onChange('quantity', event.target.value)}
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
            setShowProductSuggestions(true);
          }}
          onPickProduct={handleProductPick}
          onShowSuggestions={() => setShowProductSuggestions(true)}
          onHideSuggestions={() => setShowProductSuggestions(false)}
        />

        <label className="field">
          <span>Sale price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            list={salePriceListId}
            value={form.salePrice}
            placeholder={
              selectedProduct ? formatCurrency(getDefaultSalePrice(selectedProduct)) : ''
            }
            onChange={(event) => onChange('salePrice', event.target.value)}
          />
          <datalist id={salePriceListId}>
            {productSalePriceOptions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </label>

        <label className="field field-wide">
          <span>Note</span>
          <textarea
            rows={4}
            value={form.note}
            placeholder="Comment for the sale card"
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
        {isSaving ? 'Saving...' : isEditing ? 'Update sale' : 'Create sale'}
      </button>
    </section>
  );
};
