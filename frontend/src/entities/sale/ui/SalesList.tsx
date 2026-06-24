import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDateTime } from '../../../shared/lib/format';
import {
  getSaleProductArticle,
  getSaleProductName,
} from '../lib/sale-product';
import type { Sale } from '../model/types';
import { getSaleClientDisplayName } from '../../../widgets/dashboard/model/sale-client-display';

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
  emptyText,
  onEdit,
  onDelete,
}: SalesListProps) => {
  const { t } = useTranslation();
  const resolvedEmptyText = emptyText ?? t('legacy.salesList.empty');

  if (isLoading) {
    return <p className="empty-state">{t('legacy.salesList.loading')}</p>;
  }

  if (sales.length === 0) {
    return <p className="empty-state">{resolvedEmptyText}</p>;
  }

  return (
    <div className="stack-list">
      {sales.map((sale) => (
        <article key={sale.id} className="list-card">
          <div className="list-card-row">
            <div>
              <h3>{getSaleProductName(sale, t('legacy.salesList.defaultProduct'))}</h3>
              <p>
                {sale.recordNumber ?? 'r------'} - {getSaleProductArticle(sale) || '-'}
              </p>
            </div>
            <strong>{formatCurrency(sale.salePrice)}</strong>
          </div>

          <dl className="sale-meta">
            <div>
              <dt>{t('legacy.salesList.date')}</dt>
              <dd>{formatDateTime(sale.saleDate)}</dd>
            </div>
            <div>
              <dt>{t('legacy.salesList.quantity')}</dt>
              <dd>{sale.quantity}</dd>
            </div>
            <div>
              <dt>{t('legacy.salesList.client')}</dt>
              <dd>{getSaleClientDisplayName(sale, t)}</dd>
            </div>
            <div>
              <dt>{t('legacy.salesList.phone')}</dt>
              <dd>{sale.isRapidSale ? '-' : sale.client.phone}</dd>
            </div>
          </dl>

          <p className="muted-copy">{sale.note || t('common.noNotes')}</p>

          {onEdit && onDelete ? (
            <div className="card-actions">
              <button className="ghost-button" type="button" onClick={() => onEdit(sale)}>
                {t('common.edit')}
              </button>
              <button className="danger-button" type="button" onClick={() => onDelete(sale)}>
                {t('common.delete')}
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
};