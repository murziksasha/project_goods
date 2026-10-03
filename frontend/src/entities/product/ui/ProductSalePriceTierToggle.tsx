import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductSalePriceTier } from '../lib/sale-prices';
import { SalePriceTierToggle } from '../../../shared/ui/SalePriceTierToggle';

export interface ProductSalePriceTierToggleProps {
  activeTier: ProductSalePriceTier | null;
  onTierChange: (tier: ProductSalePriceTier) => void;
  disabled?: boolean;
}

export const ProductSalePriceTierToggle: React.FC<
  ProductSalePriceTierToggleProps
> = ({ activeTier, onTierChange, disabled = false }) => {
  const { t } = useTranslation();

  return (
    <SalePriceTierToggle
      options={[
        {
          id: 'retail',
          shortLabel: t('product.salePrice.retailShort'),
          ariaLabel: t('product.salePrice.retail'),
          variant: 'retail',
        },
        {
          id: 'wholesale',
          shortLabel: t('product.salePrice.wholesaleShort'),
          ariaLabel: t('product.salePrice.wholesale'),
          variant: 'wholesale',
        },
      ]}
      activeId={activeTier}
      onChange={onTierChange}
      disabled={disabled}
    />
  );
};
