import { ProductList } from '../../../entities/product/ui/ProductList';
import type { Product } from '../../../entities/product/model/types';

type ProductCatalogPanelProps = {
  products: Product[];
  isLoading: boolean;
  searchQuery: string;
  currentSearchValue: string;
  onSearchChange: (value: string) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

export const ProductCatalogPanel = ({
  products,
  isLoading,
  searchQuery,
  currentSearchValue,
  onSearchChange,
  onEdit,
  onDelete,
}: ProductCatalogPanelProps) => (
  <section className="panel">
    <div className="panel-header panel-header-stacked">
      <div className="panel-header-row">
        <div>
          <p className="section-label">Catalog</p>
          <h2>Product list</h2>
        </div>
      </div>

      <label className="search-field">
        <span>Search by article, serial, name, or keyword</span>
        <input
          value={currentSearchValue}
          placeholder="WM-001, LOG-M185-0001, mouse"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
    </div>

    <ProductList
      products={products}
      isLoading={isLoading}
      searchQuery={searchQuery}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  </section>
);
