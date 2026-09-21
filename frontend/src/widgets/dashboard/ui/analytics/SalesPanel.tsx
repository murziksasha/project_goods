import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { Sale } from '../../../../entities/sale';
import { SalesList } from '../../../../entities/sale';

export interface SalesPanelProps {
  sales: Sale[];
  isLoading: boolean;
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
};

export const SalesPanel: React.FC<SalesPanelProps> = ({
  sales,
  isLoading,
  onEdit,
  onDelete,
}) => {
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