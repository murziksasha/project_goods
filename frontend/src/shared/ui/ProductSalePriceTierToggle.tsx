import { useTranslation } from 'react-i18next';
import type { ProductSalePriceTier } from '../../entities/product/lib/sale-prices';
import { SalePriceTierToggle } from './SalePriceTierToggle';

type ProductSalePriceTierToggleProps = {
  activeTier: ProductSalePriceTier | null;
  onTierChange: (tier: ProductSalePriceTier) => void;
  disabled?: boolean;
};

export const ProductSalePriceTierToggle = ({
  activeTier,
  onTierChange,
  disabled = false,
}: ProductSalePriceTierToggleProps) => {
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
