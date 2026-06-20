import { useTranslation } from 'react-i18next';
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
}: ProductLookupFieldProps) => {
  const { t } = useTranslation();

  return (
    <div className="field field-wide modal-suggestions-anchor">
      <span>{t('legacy.saleForm.lookup.product')}</span>
      <input
        value={productInput}
        placeholder={t('legacy.saleForm.lookup.productPlaceholder')}
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
                onClick={() => {
                  onPickProduct(product);
                  onHideSuggestions();
                }}
              >
                <strong>{product.name}</strong>
                <span>
                  {product.article} • {product.serialNumber} •{' '}
                  {t('legacy.saleForm.lookup.freeStock', { count: product.freeQuantity })}
                </span>
              </button>
            ))
          ) : (
            <p className="suggestion-empty">{t('legacy.saleForm.lookup.noProductsFound')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
};