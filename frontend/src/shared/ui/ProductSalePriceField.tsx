import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../entities/product/model/types';
import {
  formatProductSalePrice,
  getProductSalePriceByTier,
  hasWholesaleSalePrice,
  matchesProductSalePriceTier,
  type ProductSalePriceTier,
} from '../../entities/product/lib/sale-prices';
import { NumberStepper } from './NumberStepper';

type ProductSalePriceFieldProps = {
  value: string;
  onChange: (value: string) => void;
  product: Product | null;
  priceTier: ProductSalePriceTier | null;
  onPriceTierChange: (tier: ProductSalePriceTier) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
};

export const ProductSalePriceField = ({
  value,
  onChange,
  product,
  priceTier,
  onPriceTierChange,
  disabled = false,
  placeholder = '0',
  ariaLabel,
}: ProductSalePriceFieldProps) => {
  const { t } = useTranslation();
  const showTierToggle = product ? hasWholesaleSalePrice(product) : false;

  const activeTier = useMemo(() => {
    if (!product || !showTierToggle) return null;
    if (priceTier && matchesProductSalePriceTier(product, value, priceTier)) {
      return priceTier;
    }
    if (matchesProductSalePriceTier(product, value, 'wholesale')) {
      return 'wholesale' as const;
    }
    if (matchesProductSalePriceTier(product, value, 'retail')) {
      return 'retail' as const;
    }
    return null;
  }, [priceTier, product, showTierToggle, value]);

  const handleTierChange = (tier: ProductSalePriceTier) => {
    if (!product) return;
    onPriceTierChange(tier);
    onChange(formatProductSalePrice(getProductSalePriceByTier(product, tier)));
  };

  return (
    <div className='product-sale-price-field'>
      <NumberStepper
        min={0}
        step={0.01}
        precision={2}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        ariaLabel={ariaLabel}
      />
      {showTierToggle ? (
        <div
          className='product-sale-price-tier-toggle'
          role='group'
          aria-label={t('product.salePrice.tierToggleAria')}
        >
          <button
            type='button'
            className={
              activeTier === 'retail'
                ? 'product-sale-price-tier-button product-sale-price-tier-button-active'
                : 'product-sale-price-tier-button'
            }
            onClick={() => handleTierChange('retail')}
            disabled={disabled}
          >
            {t('product.salePrice.retail')}
          </button>
          <button
            type='button'
            className={
              activeTier === 'wholesale'
                ? 'product-sale-price-tier-button product-sale-price-tier-button-active'
                : 'product-sale-price-tier-button'
            }
            onClick={() => handleTierChange('wholesale')}
            disabled={disabled}
          >
            {t('product.salePrice.wholesale')}
          </button>
        </div>
      ) : null}
    </div>
  );
};