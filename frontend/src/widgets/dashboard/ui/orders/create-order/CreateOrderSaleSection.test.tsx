import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../../../../../shared/i18n/config';
import { CreateOrderSaleSection } from './CreateOrderSaleSection';
import { createSaleOrderItem, type SaleOrderItem } from './create-order-card-shared';

const renderSection = (
  saleItems: SaleOrderItem[],
  handlers: {
    onAddSaleItem?: () => void;
    onRemoveSaleItem?: (itemId: string) => void;
  } = {},
) => {
  const onAddSaleItem = handlers.onAddSaleItem ?? vi.fn();
  const onRemoveSaleItem = handlers.onRemoveSaleItem ?? vi.fn();

  render(
    <I18nextProvider i18n={i18n}>
      <CreateOrderSaleSection
        products={[]}
        saleItems={saleItems}
        focusedSaleItem={saleItems[0] ?? null}
        visibleSaleProductSuggestions={[]}
        isSaleProductLookupLoading={false}
        saleItemsTotal={0}
        issueFromClient=""
        onIssueFromClientChange={vi.fn()}
        onFocusSaleItem={vi.fn()}
        onUpdateSaleItem={vi.fn()}
        onSaleItemQuantityChange={vi.fn()}
        onSaleItemPriceChange={vi.fn()}
        onAddSaleItem={onAddSaleItem}
        onRemoveSaleItem={onRemoveSaleItem}
        onApplySaleProduct={vi.fn()}
      />
    </I18nextProvider>,
  );

  return { onAddSaleItem, onRemoveSaleItem };
};

describe('CreateOrderSaleSection sale item actions', () => {
  it('does not add a row when clicking the action wrapper outside the button', () => {
    const { onAddSaleItem } = renderSection([createSaleOrderItem()]);

    const actionWrapper = document.querySelector('.sale-item-action') as HTMLElement;
    const labelSpacer = actionWrapper.querySelector('span') as HTMLElement;

    fireEvent.click(labelSpacer);

    expect(onAddSaleItem).not.toHaveBeenCalled();
  });

  it('adds a row only when clicking the add button', () => {
    const { onAddSaleItem } = renderSection([createSaleOrderItem()]);

    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('orders.create.addProductPosition'),
      }),
    );

    expect(onAddSaleItem).toHaveBeenCalledTimes(1);
  });

  it('does not remove a row when clicking the action wrapper outside the button', () => {
    const firstItem = createSaleOrderItem();
    const secondItem = createSaleOrderItem();
    const { onRemoveSaleItem } = renderSection([firstItem, secondItem]);

    const actionWrappers = document.querySelectorAll('.sale-item-action');
    const removeActionWrapper = actionWrappers[0] as HTMLElement;
    const labelSpacer = removeActionWrapper.querySelector('span') as HTMLElement;

    fireEvent.click(labelSpacer);

    expect(onRemoveSaleItem).not.toHaveBeenCalled();
  });

  it('removes a row only when clicking the remove button', () => {
    const firstItem = createSaleOrderItem();
    const secondItem = createSaleOrderItem();
    const { onRemoveSaleItem } = renderSection([firstItem, secondItem]);

    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('orders.create.removeProductPosition'),
      }),
    );

    expect(onRemoveSaleItem).toHaveBeenCalledTimes(1);
    expect(onRemoveSaleItem).toHaveBeenCalledWith(firstItem.id);
  });
});