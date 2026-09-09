import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

export type SalePriceTierBadgeVariant = 'retail' | 'wholesale';

export type SalePriceTierOption<T extends string> = {
  id: T;
  shortLabel: string;
  ariaLabel: string;
  variant: SalePriceTierBadgeVariant;
  wide?: boolean;
};

type SalePriceTierToggleProps<T extends string> = {
  options: Array<SalePriceTierOption<T>>;
  activeId: T | null;
  onChange: (id: T) => void;
  disabled?: boolean;
};

export const SalePriceTierToggle = <T extends string>({
  options,
  activeId,
  onChange,
  disabled = false,
}: SalePriceTierToggleProps<T>) => {
  const { t } = useTranslation();

  const handleGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || options.length === 0) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    const currentIndex = options.findIndex((option) => option.id === activeId);
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (startIndex + delta + options.length) % options.length;
    const next = options[nextIndex];
    if (next) onChange(next.id);
  };

  return (
    <div
      className="product-sale-price-tier-toggle"
      role="group"
      aria-label={t('product.salePrice.tierToggleAria')}
      onKeyDown={handleGroupKeyDown}
    >
      {options.map((option) => {
        const isActive = activeId === option.id;
        const className = [
          'product-sale-price-tier-badge',
          `product-sale-price-tier-badge-${option.variant}`,
          option.wide ? 'product-sale-price-tier-badge-wide' : '',
          isActive ? 'product-sale-price-tier-badge-active' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={option.id}
            type="button"
            className={className}
            onClick={() => onChange(option.id)}
            disabled={disabled}
            aria-label={option.ariaLabel}
            aria-pressed={isActive}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
};
