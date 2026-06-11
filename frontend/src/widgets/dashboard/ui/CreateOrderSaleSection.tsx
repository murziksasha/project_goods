import { NumberStepper } from '../../../shared/ui/NumberStepper';
import type { CreateOrderProductSuggestion } from '../model/create-order-products';
import type { SaleOrderItem } from './create-order-card-shared';

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
}: CreateOrderSaleSectionProps) => (
  <>
    <h3 className="create-section-title">Products</h3>
    <div className="sale-items-list">
      {saleItems.map((item, index) => (
        <div key={item.id} className="sale-item-row">
          <label className="field sale-item-product">
            <span>{`Product ${index + 1} *`}</span>
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
              placeholder="Name, serial or article"
            />
          </label>
          <label className="field">
            <span>Qty</span>
            <NumberStepper
              min={1}
              value={item.quantity}
              onChange={(value) => onSaleItemQuantityChange(item, value)}
              disabled={item.source === 'stock' && Boolean(item.serialNumber)}
            />
          </label>
          <label className="field">
            <span>Price</span>
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
            <span>Warranty</span>
            <select
              value={item.warrantyPeriod}
              onChange={(event) =>
                onUpdateSaleItem(item.id, {
                  warrantyPeriod: event.target.value,
                })
              }
            >
              <option value="0">None</option>
              <option value="1">30 day</option>
              <option value="3">3 month</option>
              <option value="6">6 month</option>
              <option value="12">1 year</option>
              <option value="24">2 year</option>
              <option value="36">3 year</option>
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
                  ? 'Add product position'
                  : 'Remove product position'
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
        {isSaleProductLookupLoading ? <p>Searching products...</p> : null}
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
      <span>Notes</span>
      <textarea
        rows={3}
        value={issueFromClient}
        onChange={(event) => onIssueFromClientChange(event.target.value)}
        placeholder="Sale notes"
      />
    </label>
  </>
);
