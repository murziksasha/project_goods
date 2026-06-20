import { useTranslation } from 'react-i18next';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import type { CreateOrderProductSuggestion } from '../model/create-order-products';
import type { SaleOrderItem } from './create-order-card-shared';
import { getWarrantyOptions } from './orders-workspace-shared';

type CreateOrderSaleSectionProps = {
  saleItems: SaleOrderItem[];
  focusedSaleItem: SaleOrderItem | null;
  visibleSaleProductSuggestions: CreateOrderProductSuggestion[];
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
    suggestion: CreateOrderProductSuggestion,
  ) => void;
};

export const CreateOrderSaleSection = ({
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

  return (
    <>
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
            <label className="field">
              <span>{t('orders.create.price')}</span>
              <NumberStepper
                min={0}
                step={0.01}
                precision={2}
                value={item.price}
                onChange={(value) => {
                  onSaleItemPriceChange(item, value);
                }}
                placeholder="0"
              />
            </label>
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
                {product.source === 'stock'
                  ? `${product.article || '-'} / ${product.serialNumber || '-'} / ${product.availabilityLabel}`
                  : product.note}
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
    </>
  );
};