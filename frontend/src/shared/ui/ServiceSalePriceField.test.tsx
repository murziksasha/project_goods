import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceCatalogItem } from '../../entities/service-catalog/model/types';
import { ServiceSalePriceField } from './ServiceSalePriceField';

const service: ServiceCatalogItem = {
  id: 'svc-1',
  name: 'Diagnostics',
  price: 200,
  salePriceOptions: [150, 100],
  note: '',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ServiceSalePriceField', () => {
  it('shows R/W1/W2 badges only when a wholesale price is configured', () => {
    const { rerender } = render(
      <ServiceSalePriceField
        value="200"
        onChange={vi.fn()}
        service={service}
        priceTier="retail"
        onPriceTierChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Retail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wholesale 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wholesale 2' })).toBeInTheDocument();

    rerender(
      <ServiceSalePriceField
        value="200"
        onChange={vi.fn()}
        service={{ ...service, salePriceOptions: [] }}
        priceTier="retail"
        onPriceTierChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Retail' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wholesale 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wholesale 2' })).not.toBeInTheDocument();
  });

  it('hides W2 when only wholesale 1 is configured', () => {
    render(
      <ServiceSalePriceField
        value="200"
        onChange={vi.fn()}
        service={{ ...service, salePriceOptions: [150] }}
        priceTier="retail"
        onPriceTierChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Retail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wholesale 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wholesale 2' })).not.toBeInTheDocument();
  });

  it('renders tier badges in the field label row when tierTogglePlacement is label', () => {
    const { container } = render(
      <ServiceSalePriceField
        label="Price"
        fieldClassName="field rapid-sale-price-field"
        tierTogglePlacement="label"
        value="200"
        onChange={vi.fn()}
        service={service}
        priceTier="retail"
        onPriceTierChange={vi.fn()}
      />,
    );

    const labelRow = container.querySelector('.product-sale-price-field-label');
    expect(labelRow).toBeTruthy();
    expect(labelRow?.querySelector('.product-sale-price-tier-toggle')).toBeTruthy();
    expect(
      container.querySelector('.product-sale-price-field .product-sale-price-tier-toggle'),
    ).toBeNull();
  });

  it('switches price to wholesale 1 / 2 when those badges are selected', () => {
    const onChange = vi.fn();
    const onPriceTierChange = vi.fn();

    render(
      <ServiceSalePriceField
        value="200"
        onChange={onChange}
        service={service}
        priceTier="retail"
        onPriceTierChange={onPriceTierChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Wholesale 1' }));
    expect(onPriceTierChange).toHaveBeenCalledWith('wholesale1');
    expect(onChange).toHaveBeenCalledWith('150');

    fireEvent.click(screen.getByRole('button', { name: 'Wholesale 2' }));
    expect(onPriceTierChange).toHaveBeenCalledWith('wholesale2');
    expect(onChange).toHaveBeenCalledWith('100');
  });

  it('clears the active badge when the price no longer matches a tier', () => {
    render(
      <ServiceSalePriceField
        value="199"
        onChange={vi.fn()}
        service={service}
        priceTier="retail"
        onPriceTierChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Retail' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Wholesale 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
