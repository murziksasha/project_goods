import { useTranslation } from 'react-i18next';
import type { Product } from '../../../entities/product/model/types';
import { useDismissibleSuggestions } from '../../../shared/lib/useDismissibleSuggestions';

type ProductLookupFieldProps = {
  productInput: string;
  productSuggestions: Product[];
  isBound: boolean;
  onProductChange: (value: string) => void;
  onPickProduct: (product: Product) => void;
};

export const ProductLookupField = ({
  productInput,
  productSuggestions,
  isBound,
  onProductChange,
  onPickProduct,
}: ProductLookupFieldProps) => {
  const { t } = useTranslation();
  const { rootRef, isVisible } = useDismissibleSuggestions({
    query: productInput,
    isActive: !isBound && productInput.trim().length > 0,
  });

  return (
    <div ref={rootRef} className="field field-wide modal-suggestions-anchor">
      <span>{t('legacy.saleForm.lookup.product')}</span>
      <input
        value={productInput}
        placeholder={t('legacy.saleForm.lookup.productPlaceholder')}
        onChange={(event) => onProductChange(event.target.value)}
      />

      {isVisible ? (
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