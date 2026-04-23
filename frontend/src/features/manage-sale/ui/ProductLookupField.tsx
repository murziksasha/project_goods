import type { Product } from '../../../entities/product/model/types';

type ProductLookupFieldProps = {
  productInput: string;
  productSuggestions: Product[];
  showProductSuggestions: boolean;
  onProductChange: (value: string) => void;
  onPickProduct: (product: Product) => void;
  onShowSuggestions: () => void;
  onHideSuggestions: () => void;
};

export const ProductLookupField = ({
  productInput,
  productSuggestions,
  showProductSuggestions,
  onProductChange,
  onPickProduct,
  onShowSuggestions,
  onHideSuggestions,
}: ProductLookupFieldProps) => (
  <div className="field field-wide">
    <span>Product</span>
    <input
      value={productInput}
      placeholder="Write product name, serial, or article"
      onFocus={onShowSuggestions}
      onBlur={() => window.setTimeout(onHideSuggestions, 120)}
      onChange={(event) => onProductChange(event.target.value)}
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
              onClick={() => onPickProduct(product)}
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
);
