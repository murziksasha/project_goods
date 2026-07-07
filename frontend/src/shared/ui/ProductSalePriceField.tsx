import { useMemo, type ReactNode } from 'react';
import type { Product } from '../../entities/product/model/types';
import {
  formatProductSalePrice,
  getProductSalePriceByTier,
  hasWholesaleSalePrice,
  matchesProductSalePriceTier,
  type ProductSalePriceTier,
} from '../../entities/product/lib/sale-prices';
import { NumberStepper } from './NumberStepper';
import { ProductSalePriceTierToggle } from './ProductSalePriceTierToggle';

type ProductSalePriceFieldProps = {
  value: string;
  onChange: (value: string) => void;
  product: Product | null;
  priceTier: ProductSalePriceTier | null;
  onPriceTierChange: (tier: ProductSalePriceTier) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  stepperClassName?: string;
  label?: ReactNode;
  fieldClassName?: string;
  tierTogglePlacement?: 'inline' | 'label' | 'compact' | 'none';
  onFocus?: () => void;
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
  stepperClassName,
  label,
  fieldClassName,
  tierTogglePlacement = 'inline',
  onFocus,
}: ProductSalePriceFieldProps) => {
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

  const resolvedStepperClassName = stepperClassName
    ? `${stepperClassName} product-sale-price-stepper`
    : 'product-sale-price-stepper';

  const tierToggle = showTierToggle ? (
    <ProductSalePriceTierToggle
      activeTier={activeTier}
      onTierChange={handleTierChange}
      disabled={disabled}
    />
  ) : null;

  const stepper = (
    <NumberStepper
      min={0}
      step={0.01}
      precision={2}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      ariaLabel={ariaLabel}
      className={resolvedStepperClassName}
      onFocus={onFocus}
    />
  );

  if (tierTogglePlacement === 'none') {
    return stepper;
  }

  if (tierTogglePlacement === 'compact') {
    return (
      <div className={fieldClassName ? `${fieldClassName} product-sale-price-field-compact` : 'product-sale-price-field-compact'}>
        {tierToggle ? (
          <div className='product-sale-price-field-label product-sale-price-field-label-compact'>
            {tierToggle}
          </div>
        ) : null}
        <div className='product-sale-price-field'>{stepper}</div>
      </div>
    );
  }

  const fieldContent = (
    <div className='product-sale-price-field'>
      {stepper}
      {tierToggle && tierTogglePlacement === 'inline' ? tierToggle : null}
    </div>
  );

  if (!label) {
    return fieldContent;
  }

  return (
    <label className={fieldClassName}>
      <span className='product-sale-price-field-label'>
        <span className='product-sale-price-field-label-text'>{label}</span>
        {tierToggle && tierTogglePlacement === 'label' ? tierToggle : null}
      </span>
      {fieldContent}
    </label>
  );
};