import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../shared/lib/format';
import type { ServiceCatalogItem } from '../model/types';

type ServiceCatalogListProps = {
  services: ServiceCatalogItem[];
  isLoading: boolean;
  searchQuery: string;
  onEdit: (service: ServiceCatalogItem) => void;
  onDelete: (service: ServiceCatalogItem) => void;
};

export const ServiceCatalogList = ({
  services,
  isLoading,
  searchQuery,
  onEdit,
  onDelete,
}: ServiceCatalogListProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <p className="empty-state">{t('legacy.serviceList.loading')}</p>;
  }

  if (services.length === 0) {
    return (
      <p className="empty-state">
        {searchQuery
          ? t('legacy.serviceList.noSearchResults')
          : t('legacy.serviceList.empty')}
      </p>
    );
  }

  return (
    <div className="product-list">
      {services.map((service) => (
        <article key={service.id} className="product-card">
          <div className="product-card-header">
            <div>
              <div className="product-title-row">
                <h3>{service.name}</h3>
                <span className="stock-badge stock-badge-success">
                  {t('legacy.serviceList.badge')}
                </span>
              </div>
              <p>{service.note || t('common.noNote')}</p>
            </div>
            <strong>{formatCurrency(service.price)}</strong>
          </div>

          <div className="card-actions">
            <button className="ghost-button" type="button" onClick={() => onEdit(service)}>
              {t('common.edit')}
            </button>
            <button className="danger-button" type="button" onClick={() => onDelete(service)}>
              {t('common.delete')}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};