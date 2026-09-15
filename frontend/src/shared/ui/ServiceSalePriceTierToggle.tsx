import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceCatalogItem } from '../../entities/service-catalog/model/types';
import {
  getVisibleServiceSalePriceTiers,
  type ServiceSalePriceTier,
} from '../../entities/service-catalog/lib/sale-prices';
import {
  SalePriceTierToggle,
  type SalePriceTierOption,
} from './SalePriceTierToggle';

type ServiceSalePriceTierToggleProps = {
  service: Pick<ServiceCatalogItem, 'price' | 'salePriceOptions'>;
  activeTier: ServiceSalePriceTier | null;
  onTierChange: (tier: ServiceSalePriceTier) => void;
  disabled?: boolean;
};

export const ServiceSalePriceTierToggle = ({
  service,
  activeTier,
  onTierChange,
  disabled = false,
}: ServiceSalePriceTierToggleProps) => {
  const { t } = useTranslation();

  const options = useMemo<Array<SalePriceTierOption<ServiceSalePriceTier>>>(
    () =>
      getVisibleServiceSalePriceTiers(service).map((tier) => {
        if (tier === 'wholesale1') {
          return {
            id: 'wholesale1',
            shortLabel: t('product.salePrice.wholesale1Short'),
            ariaLabel: t('product.salePrice.wholesale1'),
            variant: 'wholesale',
            wide: true,
          };
        }
        if (tier === 'wholesale2') {
          return {
            id: 'wholesale2',
            shortLabel: t('product.salePrice.wholesale2Short'),
            ariaLabel: t('product.salePrice.wholesale2'),
            variant: 'wholesale',
            wide: true,
          };
        }
        return {
          id: 'retail',
          shortLabel: t('product.salePrice.retailShort'),
          ariaLabel: t('product.salePrice.retail'),
          variant: 'retail',
        };
      }),
    [service, t],
  );

  if (options.length < 2) return null;

  return (
    <SalePriceTierToggle
      options={options}
      activeId={activeTier}
      onChange={onTierChange}
      disabled={disabled}
    />
  );
};
