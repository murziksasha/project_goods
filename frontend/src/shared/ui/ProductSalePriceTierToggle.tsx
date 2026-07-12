import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductSalePriceTier } from '../../entities/product/lib/sale-prices';

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

  const handleGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    onTierChange(activeTier === 'retail' ? 'wholesale' : 'retail');
  };

  return (
    <div
      className='product-sale-price-tier-toggle'
      role='group'
      aria-label={t('product.salePrice.tierToggleAria')}
      onKeyDown={handleGroupKeyDown}
    >
      <button
        type='button'
        className={
          activeTier === 'retail'
            ? 'product-sale-price-tier-badge product-sale-price-tier-badge-retail product-sale-price-tier-badge-active'
            : 'product-sale-price-tier-badge product-sale-price-tier-badge-retail'
        }
        onClick={() => onTierChange('retail')}
        disabled={disabled}
        aria-label={t('product.salePrice.retail')}
        aria-pressed={activeTier === 'retail'}
      >
        {t('product.salePrice.retailShort')}
      </button>
      <button
        type='button'
        className={
          activeTier === 'wholesale'
            ? 'product-sale-price-tier-badge product-sale-price-tier-badge-wholesale product-sale-price-tier-badge-active'
            : 'product-sale-price-tier-badge product-sale-price-tier-badge-wholesale'
        }
        onClick={() => onTierChange('wholesale')}
        disabled={disabled}
        aria-label={t('product.salePrice.wholesale')}
        aria-pressed={activeTier === 'wholesale'}
      >
        {t('product.salePrice.wholesaleShort')}
      </button>
    </div>
  );
};