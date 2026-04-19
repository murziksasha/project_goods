import type { Product } from '../types';

type ProductListProps = {
  products: Product[];
  isLoading: boolean;
  searchQuery: string;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string | null) => {
  if (!value) {
    return 'Not specified';
  }

  return new Intl.DateTimeFormat('uk-UA').format(new Date(value));
};

export const ProductList = ({
  products,
  isLoading,
  searchQuery,
  onEdit,
  onDelete,
}: ProductListProps) => {
  if (isLoading) {
    return <p className="empty-state">Loading products...</p>;
  }

  if (products.length === 0) {
    return (
      <p className="empty-state">
        {searchQuery
          ? 'No products found for this search query.'
          : 'No products yet. Add your first item to start the catalog.'}
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
                  {product.isInStock ? 'In stock' : 'Out of stock'}
                </span>
              </div>
              <p>{product.article}</p>
            </div>
            <strong>{formatCurrency(product.price)}</strong>
          </div>

          <dl className="product-meta">
            <div>
              <dt>Total stock</dt>
              <dd>{product.quantity}</dd>
            </div>
            <div>
              <dt>Free stock</dt>
              <dd>{product.freeQuantity}</dd>
            </div>
            <div>
              <dt>Reserved</dt>
              <dd>{product.reservedQuantity}</dd>
            </div>
            <div>
              <dt>Purchase place</dt>
              <dd>{product.purchasePlace || 'Not specified'}</dd>
            </div>
            <div>
              <dt>Purchase date</dt>
              <dd>{formatDate(product.purchaseDate)}</dd>
            </div>
            <div>
              <dt>Warranty</dt>
              <dd>{product.warrantyPeriod} months</dd>
            </div>
          </dl>

          <div className="card-actions">
            <button className="ghost-button" type="button" onClick={() => onEdit(product)}>
              Edit
            </button>
            <button className="danger-button" type="button" onClick={() => onDelete(product)}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};
