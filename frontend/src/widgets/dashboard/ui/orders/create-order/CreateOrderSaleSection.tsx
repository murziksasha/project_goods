import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDismissibleSuggestions } from '../../../../../shared/lib/useDismissibleSuggestions';
import { useReorderableSuggestions } from '../../../../../shared/lib/useReorderableSuggestions';
import { ReorderableSuggestionItem } from '../../../../../shared/ui/ReorderableSuggestionItem';
import type { Product } from '../../../../../entities/product';
import type { ProductSalePriceTier } from '../../../../../entities/product';
import { NumberStepper } from '../../../../../shared/ui/NumberStepper';
import { ProductSalePriceField } from '../../../../../entities/product';
import { formatCurrency } from '../../../../../shared/lib/format';
import type { OrderDetailProductSuggestion } from '../../../model/create-order-products';
import type { SaleOrderItem } from './create-order-card-shared';
import { getWarrantyOptions } from '../workspace/orders-workspace-shared';

export interface CreateOrderSaleSectionProps {
  products: Product[];
  saleItems: SaleOrderItem[];
  focusedSaleItem: SaleOrderItem | null;
  visibleSaleProductSuggestions: OrderDetailProductSuggestion[];
  isSaleProductLookupLoading: boolean;
  canManageOrders?: boolean;
  saleItemsTotal: number;
  issueFromClient: string;
  onIssueFromClientChange: (value: string) => void;
  onFocusSaleItem: (itemId: string) => void;
  onUpdateSaleItem: (
    itemId: string,
    patch: Partial<SaleOrderItem>,
  ) => void;
  onSaleItemQuantityChange: (item: SaleOrderItem, value: string) => void;
  onSaleItemPriceChange: (item: SaleOrderItem, value: string) => void;
  onAddSaleItem: () => void;
  onRemoveSaleItem: (itemId: string) => void;
  onApplySaleProduct: (
    itemId: string,
    suggestion: OrderDetailProductSuggestion,
  ) => void;
  onReorderSuggestions?: (
    items: OrderDetailProductSuggestion[],
  ) => Promise<void>;
};

export const CreateOrderSaleSection: React.FC<CreateOrderSaleSectionProps> = ({
  products,
  saleItems,
  focusedSaleItem,
  visibleSaleProductSuggestions,
  isSaleProductLookupLoading,
  canManageOrders = false,
  saleItemsTotal,
  issueFromClient,
  onIssueFromClientChange,
  onFocusSaleItem,
  onUpdateSaleItem,
  onSaleItemQuantityChange,
  onSaleItemPriceChange,
  onAddSaleItem,
  onRemoveSaleItem,
  onApplySaleProduct,
  onReorderSuggestions,
}) => {
  const { t } = useTranslation();
  const warrantyOptions = getWarrantyOptions();
  const {
    rootRef: saleProductSuggestionsRootRef,
    isVisible: isSaleProductSuggestionsVisible,
  } = useDismissibleSuggestions({
    query: focusedSaleItem?.query ?? '',
    isActive:
      visibleSaleProductSuggestions.length > 0 || isSaleProductLookupLoading,
  });
  const productReorder = useReorderableSuggestions<OrderDetailProductSuggestion>({
    items: visibleSaleProductSuggestions,
    onSelect: (product) => {
      if (focusedSaleItem) {
        onApplySaleProduct(focusedSaleItem.id, product);
      }
    },
    onReorder: onReorderSuggestions,
    canReorder: Boolean(canManageOrders),
    isVisible: isSaleProductSuggestionsVisible,
  });
  const productsById = useMemo(
    () => Object.fromEntries(products.map((product) => [product.id, product])),
    [products],
  );
  const [priceTierByItemId, setPriceTierByItemId] = useState<
    Record<string, ProductSalePriceTier | null>
  >({});
  const previousProductIdByItemIdRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const nextTiers: Record<string, ProductSalePriceTier> = {};
    saleItems.forEach((item) => {
      const previousProductId = previousProductIdByItemIdRef.current[item.id];
      if (item.productId && item.productId !== previousProductId) {
        nextTiers[item.id] = 'retail';
      }
      previousProductIdByItemIdRef.current[item.id] = item.productId;
    });
    if (Object.keys(nextTiers).length > 0) {
      setPriceTierByItemId((current) => ({ ...current, ...nextTiers }));
    }
  }, [saleItems]);

  return (
    <section className="create-order-sale-section create-order-sale-products-section">
      <h3 className="create-section-title">{t('orders.create.products')}</h3>
      <div className="sale-items-list">
        {saleItems.map((item, index) => (
          <div key={item.id} className="sale-item-row">
            <label
              className={
                item.id === focusedSaleItem?.id
                  ? 'field sale-item-product modal-suggestions-anchor'
                  : 'field sale-item-product'
              }
              ref={
                item.id === focusedSaleItem?.id
                  ? saleProductSuggestionsRootRef
                  : undefined
              }
            >
              <span>{t('orders.create.productNumber', { number: index + 1 })}</span>
              <input
                value={item.query}
                onFocus={() => onFocusSaleItem(item.id)}
                onChange={(event) => {
                  onFocusSaleItem(item.id);
                  onUpdateSaleItem(item.id, {
                    query: event.target.value,
                    source: '',
                    productId: '',
                    catalogProductId: '',
                    article: '',
                    serialNumber: '',
                  });
                }}
                onKeyDown={(event) => {
                  if (
                    item.id === focusedSaleItem?.id &&
                    isSaleProductSuggestionsVisible &&
                    visibleSaleProductSuggestions.length > 0
                  ) {
                    if (
                      event.key === 'ArrowDown' ||
                      event.key === 'ArrowUp' ||
                      (event.key === 'Enter' && productReorder.activeIndex >= 0)
                    ) {
                      productReorder.handleKeyDown(event);
                      return;
                    }
                  }
                }}
                placeholder={t('orders.create.productSearchPlaceholder')}
              />
              {item.id === focusedSaleItem?.id &&
              isSaleProductSuggestionsVisible ? (
                <div className="create-suggestions">
                  {isSaleProductLookupLoading ? (
                    <p>{t('orders.create.searchingProducts')}</p>
                  ) : null}
                  {visibleSaleProductSuggestions.map((product, pIndex) => (
                    <ReorderableSuggestionItem
                      key={product.id}
                      id={product.id}
                      isActive={productReorder.activeIndex === pIndex}
                      disabled={!product.selectable}
                      canReorder={Boolean(canManageOrders)}
                      isFirst={pIndex === 0}
                      isLast={pIndex === visibleSaleProductSuggestions.length - 1}
                      onSelect={() =>
                        focusedSaleItem &&
                        onApplySaleProduct(focusedSaleItem.id, product)
                      }
                      onMoveUp={() => productReorder.moveItem(pIndex, 'up')}
                      onMoveDown={() => productReorder.moveItem(pIndex, 'down')}
                      onDragStart={(e) => productReorder.handleDragStart(e, pIndex)}
                      onDragOver={(e) => productReorder.handleDragOver(e, pIndex)}
                      onDrop={(e) => productReorder.handleDrop(e, pIndex)}
                      onDragEnd={productReorder.handleDragEnd}
                      isDragging={productReorder.draggedIndex === pIndex}
                      isDragOver={productReorder.dragOverIndex === pIndex}
                      ariaLabel={product.name}
                      title={
                        product.selectable ? undefined : product.availabilityLabel
                      }
                    >
                      <strong>{product.name}</strong>
                      <span>
                        {product.source === 'stock' ? (
                          <>
                            <strong>{product.warehouseName ?? '-'}</strong>
                            {' / '}
                            {formatCurrency(product.price)} /{' '}
                            {product.article || '-'} /{' '}
                            {product.serialNumber || '-'} /{' '}
                            {product.availabilityLabel}
                          </>
                        ) : (
                          <>
                            {product.price > 0 ? (
                              <>
                                {formatCurrency(product.price)}
                                {' / '}
                              </>
                            ) : null}
                            {product.note}
                          </>
                        )}
                      </span>
                    </ReorderableSuggestionItem>
                  ))}
                </div>
              ) : null}
            </label>
            <label className="field">
              <span>{t('orders.create.qty')}</span>
              <NumberStepper
                min={1}
                value={item.quantity}
                onChange={(value) => onSaleItemQuantityChange(item, value)}
                disabled={item.source === 'stock' && Boolean(item.serialNumber)}
              />
            </label>
            <ProductSalePriceField
              label={t('orders.create.price')}
              fieldClassName="field sale-item-price-field sale-price-field-labeled"
              tierTogglePlacement="label"
              value={item.price}
              onChange={(value) => onSaleItemPriceChange(item, value)}
              product={
                item.productId ? productsById[item.productId] ?? null : null
              }
              priceTier={priceTierByItemId[item.id] ?? null}
              onPriceTierChange={(tier) =>
                setPriceTierByItemId((current) => ({
                  ...current,
                  [item.id]: tier,
                }))
              }
              placeholder="0"
              ariaLabel={t('orders.create.price')}
            />
            <label className="field">
              <span>{t('orders.create.warranty')}</span>
              <select
                value={item.warrantyPeriod}
                onChange={(event) =>
                  onUpdateSaleItem(item.id, {
                    warrantyPeriod: event.target.value,
                  })
                }
              >
                {warrantyOptions.map((option) => (
                  <option key={option.value} value={String(option.value)}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <div className="field sale-item-action">
              <span aria-hidden="true">&nbsp;</span>
              <button
                type="button"
                className="toolbar-square-button sale-item-add-button"
                onClick={
                  index === saleItems.length - 1
                    ? onAddSaleItem
                    : () => onRemoveSaleItem(item.id)
                }
                aria-label={
                  index === saleItems.length - 1
                    ? t('orders.create.addProductPosition')
                    : t('orders.create.removeProductPosition')
                }
              >
                {index === saleItems.length - 1 ? '+' : '-'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="sale-order-unavailable">
        <span>{`${Math.round(saleItemsTotal * 100) / 100} UAH`}</span>
      </div>

      <label className="field">
        <span>{t('orders.create.saleNotes')}</span>
        <textarea
          rows={3}
          value={issueFromClient}
          onChange={(event) => onIssueFromClientChange(event.target.value)}
          placeholder={t('orders.create.saleNotesPlaceholder')}
        />
      </label>
    </section>
  );
};