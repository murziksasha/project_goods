import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '../../../shared/lib/format';
import type { Product } from '../model/types';

type ProductListProps = {
  products: Product[];
  isLoading: boolean;
  searchQuery: string;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

export const ProductList = ({
  products,
  isLoading,
  searchQuery,
  onEdit,
  onDelete,
}: ProductListProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <p className="empty-state">{t('legacy.productList.loading')}</p>;
  }

  if (products.length === 0) {
    return (
      <p className="empty-state">
        {searchQuery
          ? t('legacy.productList.noSearchResults')
          : t('legacy.productList.empty')}
      </p>
    );
  }

  return (
    <div className="product-list">
      {products.map((product) => (
        <article key={product.id} className="product-card">
          <div className="product-card-header">
            <div>
              <div className="product-title-row">
                <h3>{product.name}</h3>
                <span
                  className={
                    product.isInStock
                      ? 'stock-badge stock-badge-success'
                      : 'stock-badge stock-badge-danger'
                  }
                >
                  {product.isInStock
                    ? t('legacy.productList.inStock')
                    : t('legacy.productList.outOfStock')}
                </span>
              </div>
              <p>{product.article}</p>
              <p>{t('common.serial', { value: product.serialNumber })}</p>
            </div>
            <strong>{formatCurrency(product.price)}</strong>
          </div>

          <dl className="product-meta">
            <div>
              <dt>{t('legacy.productList.salePrices')}</dt>
              <dd>
                {product.salePriceOptions.length > 0
                  ? product.salePriceOptions
                      .map((value) => formatCurrency(value))
                      .join(', ')
                  : formatCurrency(product.price)}
              </dd>
            </div>
            <div>
              <dt>{t('legacy.productList.totalStock')}</dt>
              <dd>{product.quantity}</dd>
            </div>
            <div>
              <dt>{t('legacy.productList.freeStock')}</dt>
              <dd>{product.freeQuantity}</dd>
            </div>
            <div>
              <dt>{t('legacy.productList.reserved')}</dt>
              <dd>{product.reservedQuantity}</dd>
            </div>
            <div>
              <dt>{t('legacy.productList.purchasePlace')}</dt>
              <dd>{product.purchasePlace || t('common.notSpecified')}</dd>
            </div>
            <div>
              <dt>{t('legacy.productList.purchaseDate')}</dt>
              <dd>{formatDate(product.purchaseDate)}</dd>
            </div>
            <div>
              <dt>{t('legacy.productList.warranty')}</dt>
              <dd>{t('common.months', { count: product.warrantyPeriod })}</dd>
            </div>
            <div>
              <dt>{t('legacy.productList.defaultNote')}</dt>
              <dd>{product.note || t('common.noNote')}</dd>
            </div>
          </dl>

          <div className="card-actions">
            <button className="ghost-button" type="button" onClick={() => onEdit(product)}>
              {t('common.edit')}
            </button>
            <button className="danger-button" type="button" onClick={() => onDelete(product)}>
              {t('common.delete')}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};