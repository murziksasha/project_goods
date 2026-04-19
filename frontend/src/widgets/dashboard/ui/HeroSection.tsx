type HeroSectionProps = {
  productCount: number;
  clientCount: number;
  saleCount: number;
  totalFreeStock: number;
  isSeeding: boolean;
  isExporting: boolean;
  hasProducts: boolean;
  onSeed: () => void;
  onExport: () => void;
};

export const HeroSection = ({
  productCount,
  clientCount,
  saleCount,
  totalFreeStock,
  isSeeding,
  isExporting,
  hasProducts,
  onSeed,
  onExport,
}: HeroSectionProps) => (
  <section className="hero-card">
    <div className="hero-copy">
      <p className="eyebrow">Goods Accounting</p>
      <h1>Manage stock, client cards, edits, deletions, and purchase history.</h1>
      <p className="hero-text">
        The workspace supports full CRUD for products, clients, and sales, plus
        client status filtering and a dedicated purchase history panel.
      </p>

      <div className="hero-actions">
        <button className="primary-button" type="button" onClick={onSeed} disabled={isSeeding}>
          {isSeeding ? 'Seeding...' : 'Create demo data'}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={onExport}
          disabled={isExporting || !hasProducts}
        >
          {isExporting ? 'Exporting...' : 'Export products'}
        </button>
      </div>
    </div>

    <div className="hero-metrics">
      <div className="metric-card">
        <span className="metric-label">Products</span>
        <strong>{productCount}</strong>
      </div>
      <div className="metric-card">
        <span className="metric-label">Clients</span>
        <strong>{clientCount}</strong>
      </div>
      <div className="metric-card">
        <span className="metric-label">Sales</span>
        <strong>{saleCount}</strong>
      </div>
      <div className="metric-card">
        <span className="metric-label">Free stock</span>
        <strong>{totalFreeStock}</strong>
      </div>
    </div>
  </section>
);
