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

const getProductLabel = (product: Product) =>
  `${product.article} • ${product.name} • free ${product.freeQuantity}`;

export const SaleForm = ({
  clients,
  products,
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onCancelEdit,
}: SaleFormProps) => (
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

      <label className="field field-wide">
        <span>Client</span>
        <select
          value={form.clientId}
          onChange={(event) => onChange('clientId', event.target.value)}
        >
          <option value="">Select client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} • {client.phone} • {client.status}
            </option>
          ))}
        </select>
      </label>

      <label className="field field-wide">
        <span>Product</span>
        <select
          value={form.productId}
          onChange={(event) => onChange('productId', event.target.value)}
        >
          <option value="">Select product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {getProductLabel(product)}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Sale price</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.salePrice}
          onChange={(event) => onChange('salePrice', event.target.value)}
        />
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
