import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../entities/product/model/types';
import { ProductSalePriceField } from './ProductSalePriceField';

const product: Product = {
  id: 'p1',
  name: 'Test product',
  article: 'A1',
  serialNumber: 'S1',
  price: 100,
  salePriceOptions: [1000, 800],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  purchaseDate: null,
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProductSalePriceField', () => {
  it('shows retail/wholesale tier badges only when wholesale price is configured', () => {
    const { rerender } = render(
      <ProductSalePriceField
        value="1000"
        onChange={vi.fn()}
        product={product}
        priceTier="retail"
        onPriceTierChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Retail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wholesale' })).toBeInTheDocument();

    rerender(
      <ProductSalePriceField
        value="1000"
        onChange={vi.fn()}
        product={{ ...product, salePriceOptions: [1000] }}
        priceTier="retail"
        onPriceTierChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Retail' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wholesale' })).not.toBeInTheDocument();
  });

  it('switches price to wholesale when wholesale tier badge is selected', () => {
    const onChange = vi.fn();
    const onPriceTierChange = vi.fn();

    render(
      <ProductSalePriceField
        value="1000"
        onChange={onChange}
        product={product}
        priceTier="retail"
        onPriceTierChange={onPriceTierChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Wholesale' }));

    expect(onPriceTierChange).toHaveBeenCalledWith('wholesale');
    expect(onChange).toHaveBeenCalledWith('800');
  });
});