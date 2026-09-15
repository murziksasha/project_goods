import { useMemo, type ReactNode } from 'react';
import type { ServiceCatalogItem } from '../../entities/service-catalog/model/types';
import {
  formatServiceSalePrice,
  getServiceSalePriceByTier,
  hasServiceWholesaleSalePrice,
  matchesServiceSalePriceTier,
  type ServiceSalePriceTier,
} from '../../entities/service-catalog/lib/sale-prices';
import {
  PRICE_STEPPER_PRECISION,
  PRICE_STEPPER_STEP,
} from '../lib/price-stepper';
import { NumberStepper } from './NumberStepper';
import { ServiceSalePriceTierToggle } from './ServiceSalePriceTierToggle';

type ServiceSalePriceFieldProps = {
  value: string;
  onChange: (value: string) => void;
  service: Pick<ServiceCatalogItem, 'price' | 'salePriceOptions'> | null;
  priceTier: ServiceSalePriceTier | null;
  onPriceTierChange: (tier: ServiceSalePriceTier) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  stepperClassName?: string;
  step?: number;
  precision?: number;
  label?: ReactNode;
  fieldClassName?: string;
  tierTogglePlacement?: 'inline' | 'label' | 'compact' | 'none';
  onFocus?: () => void;
};

export const ServiceSalePriceField = ({
  value,
  onChange,
  service,
  priceTier,
  onPriceTierChange,
  disabled = false,
  placeholder = '0',
  ariaLabel,
  stepperClassName,
  step = PRICE_STEPPER_STEP,
  precision = PRICE_STEPPER_PRECISION,
  label,
  fieldClassName,
  tierTogglePlacement = 'inline',
  onFocus,
}: ServiceSalePriceFieldProps) => {
  const showTierToggle = service ? hasServiceWholesaleSalePrice(service) : false;

  const activeTier = useMemo(() => {
    if (!service || !showTierToggle) return null;
    if (priceTier && matchesServiceSalePriceTier(service, value, priceTier)) {
      return priceTier;
    }
    if (matchesServiceSalePriceTier(service, value, 'wholesale1')) {
      return 'wholesale1' as const;
    }
    if (matchesServiceSalePriceTier(service, value, 'wholesale2')) {
      return 'wholesale2' as const;
    }
    if (matchesServiceSalePriceTier(service, value, 'retail')) {
      return 'retail' as const;
    }
    return null;
  }, [priceTier, service, showTierToggle, value]);

  const handleTierChange = (tier: ServiceSalePriceTier) => {
    if (!service) return;
    onPriceTierChange(tier);
    onChange(formatServiceSalePrice(getServiceSalePriceByTier(service, tier)));
  };

  const resolvedStepperClassName = stepperClassName
    ? `${stepperClassName} product-sale-price-stepper`
    : 'product-sale-price-stepper';

  const tierToggle = showTierToggle && service ? (
    <ServiceSalePriceTierToggle
      service={service}
      activeTier={activeTier}
      onTierChange={handleTierChange}
      disabled={disabled}
    />
  ) : null;

  const stepper = (
    <NumberStepper
      min={0}
      step={step}
      precision={precision}
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
          <div className="product-sale-price-field-label product-sale-price-field-label-compact">
            {tierToggle}
          </div>
        ) : null}
        <div className="product-sale-price-field">{stepper}</div>
      </div>
    );
  }

  const fieldContent = (
    <div className="product-sale-price-field">
      {stepper}
      {tierToggle && tierTogglePlacement === 'inline' ? tierToggle : null}
    </div>
  );

  if (!label) {
    return fieldContent;
  }

  return (
    <label className={fieldClassName}>
      <span className="product-sale-price-field-label">
        <span className="product-sale-price-field-label-text">{label}</span>
        {tierToggle && tierTogglePlacement === 'label' ? tierToggle : null}
      </span>
      {fieldContent}
    </label>
  );
};
