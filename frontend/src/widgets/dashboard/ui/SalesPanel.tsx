import { useTranslation } from 'react-i18next';
import type { Sale } from '../../../entities/sale/model/types';
import { SalesList } from '../../../entities/sale/ui/SalesList';

export type SalesPanelProps = {
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
}: SalesPanelProps) => {
  const { t } = useTranslation();

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="section-label">{t('legacy.salesPanel.sectionLabel')}</p>
          <h2>{t('legacy.salesPanel.title')}</h2>
        </div>
      </div>

      <SalesList
        sales={sales}
        isLoading={isLoading}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </section>
  );
};