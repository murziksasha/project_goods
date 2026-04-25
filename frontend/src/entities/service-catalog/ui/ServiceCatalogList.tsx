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
  if (isLoading) {
    return <p className="empty-state">Loading services...</p>;
  }

  if (services.length === 0) {
    return (
      <p className="empty-state">
        {searchQuery
          ? 'No services found for this search query.'
          : 'No services yet. Add the first service to the catalog.'}
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
                <span className="stock-badge stock-badge-success">Service</span>
              </div>
              <p>{service.note || 'No note'}</p>
            </div>
            <strong>{formatCurrency(service.price)}</strong>
          </div>

          <div className="card-actions">
            <button className="ghost-button" type="button" onClick={() => onEdit(service)}>
              Edit
            </button>
            <button className="danger-button" type="button" onClick={() => onDelete(service)}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};
