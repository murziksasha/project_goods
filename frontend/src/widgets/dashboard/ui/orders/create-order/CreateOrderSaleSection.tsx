import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../../../../entities/product/model/types';
import type { ProductSalePriceTier } from '../../../../../entities/product/lib/sale-prices';
import { NumberStepper } from '../../../../../shared/ui/NumberStepper';
import { ProductSalePriceField } from '../../../../../shared/ui/ProductSalePriceField';
import { formatCurrency } from '../../../../../shared/lib/format';
import type { OrderDetailProductSuggestion } from '../../../model/create-order-products';
import type { SaleOrderItem } from './create-order-card-shared';
import { getWarrantyOptions } from '../workspace/orders-workspace-shared';

type CreateOrderSaleSectionProps = {
  products: Product[];
  saleItems: SaleOrderItem[];
  focusedSaleItem: SaleOrderItem | null;
  visibleSaleProductSuggestions: OrderDetailProductSuggestion[];
  isSaleProductLookupLoading: boolean;
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
};

export const CreateOrderSaleSection = ({
  products,
  saleItems,
  focusedSaleItem,
  visibleSaleProductSuggestions,
  isSaleProductLookupLoading,
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
}: CreateOrderSaleSectionProps) => {
  const { t } = useTranslation();
  const warrantyOptions = getWarrantyOptions();
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
            <label className="field sale-item-product">
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
                placeholder={t('orders.create.productSearchPlaceholder')}
              />
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
            <label className="field">
              <span>&nbsp;</span>
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
            </label>
          </div>
        ))}
      </div>

      {visibleSaleProductSuggestions.length > 0 ||
      isSaleProductLookupLoading ? (
        <div className="create-suggestions">
          {isSaleProductLookupLoading ? (
            <p>{t('orders.create.searchingProducts')}</p>
          ) : null}
          {visibleSaleProductSuggestions.map((product) => (
            <button
              key={product.id}
              type="button"
              className="create-suggestion-item"
              disabled={!product.selectable}
              title={product.selectable ? undefined : product.availabilityLabel}
              onClick={() =>
                focusedSaleItem &&
                onApplySaleProduct(focusedSaleItem.id, product)
              }
            >
              <strong>{product.name}</strong>
              <span>
                {product.source === 'stock' ? (
                  <>
                    <strong>{product.warehouseName ?? '-'}</strong>
                    {' / '}
                    {formatCurrency(product.price)} / {product.article || '-'} /{' '}
                    {product.serialNumber || '-'} / {product.availabilityLabel}
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
            </button>
          ))}
          <div className="sale-order-unavailable">
            <span>{`${Math.round(saleItemsTotal * 100) / 100} UAH`}</span>
          </div>
        </div>
      ) : null}

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