import { useEffect, useId, useRef, useState } from 'react';
import type { Client, Product, SaleFormValues } from '../types';

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

const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 6;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 2,
  }).format(value);

const normalizeText = (value: string) => value.trim().toLowerCase();
const normalizeDigits = (value: string) => value.replace(/\D/g, '');

const getProductLabel = (product: Product) =>
  `${product.name} • ${product.article} • ${product.serialNumber}`;

const getDefaultSalePrice = (product: Product) =>
  product.salePriceOptions[0] ?? product.price;

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
  const previousClientIdRef = useRef(form.clientId);
  const previousProductIdRef = useRef(form.productId);

  const selectedClient =
    clients.find((client) => client.id === form.clientId) ?? null;
  const selectedProduct =
    products.find((product) => product.id === form.productId) ?? null;

  useEffect(() => {
    if (selectedClient) {
      setClientNameInput(selectedClient.name);
      setClientPhoneInput(selectedClient.phone);
    } else if (previousClientIdRef.current && !form.clientId) {
      const previousClient = clients.find(
        (client) => client.id === previousClientIdRef.current,
      );

      if (
        previousClient &&
        clientNameInput === previousClient.name &&
        clientPhoneInput === previousClient.phone
      ) {
        setClientNameInput('');
        setClientPhoneInput('');
      }
    }

    previousClientIdRef.current = form.clientId;
  }, [
    clientNameInput,
    clientPhoneInput,
    clients,
    form.clientId,
    selectedClient,
  ]);

  useEffect(() => {
    if (selectedProduct) {
      setProductInput(getProductLabel(selectedProduct));
    } else if (previousProductIdRef.current && !form.productId) {
      const previousProduct = products.find(
        (product) => product.id === previousProductIdRef.current,
      );

      if (
        previousProduct &&
        productInput === getProductLabel(previousProduct)
      ) {
        setProductInput('');
      }
    }

    previousProductIdRef.current = form.productId;
  }, [form.productId, productInput, products, selectedProduct]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const normalizedName = normalizeText(clientNameInput);
      const normalizedPhone = normalizeDigits(clientPhoneInput);

      const nextSuggestions = clients
        .filter((client) => {
          const matchesName =
            !normalizedName ||
            client.name.toLowerCase().includes(normalizedName);
          const matchesPhone =
            !normalizedPhone ||
            normalizeDigits(client.phone).includes(normalizedPhone);

          return matchesName && matchesPhone;
        })
        .slice(0, MAX_SUGGESTIONS);

      setClientSuggestions(nextSuggestions);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [clientNameInput, clientPhoneInput, clients]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const normalizedQuery = normalizeText(productInput);

      const nextSuggestions = products
        .filter((product) => {
          if (!normalizedQuery) {
            return true;
          }

          return [product.name, product.article, product.serialNumber, product.note]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery);
        })
        .slice(0, MAX_SUGGESTIONS);

      setProductSuggestions(nextSuggestions);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [productInput, products]);

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
    ? Array.from(new Set([getDefaultSalePrice(selectedProduct), ...selectedProduct.salePriceOptions]))
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

        <div className="field field-wide">
          <span>Client</span>
          <div className="form-grid compact-form-grid">
            <label className="field">
              <span>Name</span>
              <input
                value={clientNameInput}
                placeholder="Write client name"
                onFocus={() => setShowClientSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowClientSuggestions(false), 120)}
                onChange={(event) => {
                  onChange('clientId', '');
                  setClientNameInput(event.target.value);
                  setShowClientSuggestions(true);
                }}
              />
            </label>

            <label className="field">
              <span>Phone</span>
              <input
                value={clientPhoneInput}
                placeholder="Write phone number"
                onFocus={() => setShowClientSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowClientSuggestions(false), 120)}
                onChange={(event) => {
                  onChange('clientId', '');
                  setClientPhoneInput(event.target.value);
                  setShowClientSuggestions(true);
                }}
              />
            </label>
          </div>

          {showClientSuggestions ? (
            <div className="suggestions-panel">
              {clientSuggestions.length > 0 ? (
                clientSuggestions.map((client) => (
                  <button
                    key={client.id}
                    className="suggestion-item"
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleClientPick(client)}
                  >
                    <strong>{client.name}</strong>
                    <span>
                      {client.phone} • {client.status}
                    </span>
                  </button>
                ))
              ) : (
                <p className="suggestion-empty">No matching clients found.</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="field field-wide">
          <span>Product</span>
          <input
            value={productInput}
            placeholder="Write product name, serial, or article"
            onFocus={() => setShowProductSuggestions(true)}
            onBlur={() => window.setTimeout(() => setShowProductSuggestions(false), 120)}
            onChange={(event) => {
              onChange('productId', '');
              setProductInput(event.target.value);
              setShowProductSuggestions(true);
            }}
          />

          {showProductSuggestions ? (
            <div className="suggestions-panel">
              {productSuggestions.length > 0 ? (
                productSuggestions.map((product) => (
                  <button
                    key={product.id}
                    className="suggestion-item"
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleProductPick(product)}
                  >
                    <strong>{product.name}</strong>
                    <span>
                      {product.article} • {product.serialNumber} • free {product.freeQuantity}
                    </span>
                  </button>
                ))
              ) : (
                <p className="suggestion-empty">No matching products found.</p>
              )}
            </div>
          ) : null}
        </div>

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
