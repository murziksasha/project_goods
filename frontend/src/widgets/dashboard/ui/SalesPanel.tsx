import type { Sale } from '../../../entities/sale/model/types';
import { SalesList } from '../../../entities/sale/ui/SalesList';

type SalesPanelProps = {
  sales: Sale[];
  isLoading: boolean;
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
};

export const SalesPanel = ({
  sales,
  isLoading,
  onEdit,
  onDelete,
}: SalesPanelProps) => (
  <section className="panel">
    <div className="panel-header">
      <div>
        <p className="section-label">Sales</p>
        <h2>Sales history</h2>
      </div>
    </div>

    <SalesList sales={sales} isLoading={isLoading} onEdit={onEdit} onDelete={onDelete} />
  </section>
);
