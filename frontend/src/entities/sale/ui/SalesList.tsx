import { formatCurrency, formatDateTime } from '../../../shared/lib/format';
import type { Sale } from '../model/types';

type SalesListProps = {
  sales: Sale[];
  isLoading: boolean;
  emptyText?: string;
  onEdit?: (sale: Sale) => void;
  onDelete?: (sale: Sale) => void;
};

export const SalesList = ({
  sales,
  isLoading,
  emptyText = 'No sales yet.',
  onEdit,
  onDelete,
}: SalesListProps) => {
  if (isLoading) {
    return <p className="empty-state">Loading sales...</p>;
  }

  if (sales.length === 0) {
    return <p className="empty-state">{emptyText}</p>;
  }

  return (
    <div className="stack-list">
      {sales.map((sale) => (
        <article key={sale.id} className="list-card">
          <div className="list-card-row">
            <div>
              <h3>{sale.product.name}</h3>
              <p>{sale.recordNumber ?? 'r------'} · {sale.product.article}</p>
            </div>
            <strong>{formatCurrency(sale.salePrice)}</strong>
          </div>

          <dl className="sale-meta">
            <div>
              <dt>Date</dt>
              <dd>{formatDateTime(sale.saleDate)}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{sale.quantity}</dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>{sale.client.name}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{sale.client.phone}</dd>
            </div>
          </dl>

          <p className="muted-copy">{sale.note || 'No notes.'}</p>

          {onEdit && onDelete ? (
            <div className="card-actions">
              <button className="ghost-button" type="button" onClick={() => onEdit(sale)}>
                Edit
              </button>
              <button className="danger-button" type="button" onClick={() => onDelete(sale)}>
                Delete
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
};
