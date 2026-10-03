import type React from 'react';
import { useTranslation } from 'react-i18next';
import { useDismissibleSuggestions } from '../../../../../shared/lib/useDismissibleSuggestions';
import { useReorderableSuggestions } from '../../../../../shared/lib/useReorderableSuggestions';
import { ReorderableSuggestionItem } from '../../../../../shared/ui/ReorderableSuggestionItem';
import type { ServiceCatalogItem } from '../../../../../entities/service-catalog';
import type { ServiceSalePriceTier } from '../../../../../entities/service-catalog';
import { NumberStepper } from '../../../../../shared/ui/NumberStepper';
import { ServiceSalePriceField } from '../../../../../entities/service-catalog';
import { formatCurrency } from '../../../../../shared/lib/format';
import type { SaleServiceOrderItem } from './create-order-card-shared';
import { getWarrantyOptions } from '../workspace/orders-workspace-shared';

const COLLAPSE_ICON_EXPANDED = '\u2303';
const COLLAPSE_ICON_COLLAPSED = '\u2304';

export interface CreateOrderSaleServicesSectionProps {
  isOpen: boolean;
  serviceQuery: string;
  servicePrice: string;
  servicePriceTier: ServiceSalePriceTier | null;
  selectedService: ServiceCatalogItem | null;
  serviceQuantity: string;
  serviceWarranty: string;
  serviceSuggestions: ServiceCatalogItem[];
  isServiceLookupLoading: boolean;
  canCreateMissingService: boolean;
  canManageOrders?: boolean;
  saleServiceItems: SaleServiceOrderItem[];
  onToggle: () => void;
  onServiceQueryChange: (value: string) => void;
  onServicePriceChange: (value: string) => void;
  onServicePriceTierChange: (tier: ServiceSalePriceTier) => void;
  onServiceQuantityChange: (value: string) => void;
  onServiceWarrantyChange: (value: string) => void;
  onApplyServiceSuggestion: (service: ServiceCatalogItem) => void;
  onAddService: () => void;
  onOpenCreateService: () => void;
  onRemoveServiceItem: (itemId: string) => void;
  onReorderSuggestions?: (items: ServiceCatalogItem[]) => Promise<void>;
};

export const CreateOrderSaleServicesSection: React.FC<CreateOrderSaleServicesSectionProps> = ({
  isOpen,
  serviceQuery,
  servicePrice,
  servicePriceTier,
  selectedService,
  serviceQuantity,
  serviceWarranty,
  serviceSuggestions,
  isServiceLookupLoading,
  canCreateMissingService,
  canManageOrders = false,
  saleServiceItems,
  onToggle,
  onServiceQueryChange,
  onServicePriceChange,
  onServicePriceTierChange,
  onServiceQuantityChange,
  onServiceWarrantyChange,
  onApplyServiceSuggestion,
  onAddService,
  onOpenCreateService,
  onRemoveServiceItem,
  onReorderSuggestions,
}) => {
  const { t } = useTranslation();
  const warrantyOptions = getWarrantyOptions();
  const visibleServiceSuggestions =
    serviceQuery.trim().length >= 2 ? serviceSuggestions : [];
  const {
    rootRef: serviceSuggestionsRootRef,
    panelRef: serviceSuggestionsPanelRef,
    isVisible: isServiceSuggestionsVisible,
  } = useDismissibleSuggestions({
    query: serviceQuery,
    isActive:
      visibleServiceSuggestions.length > 0 || isServiceLookupLoading,
  });
  const serviceReorder = useReorderableSuggestions<ServiceCatalogItem>({
    items: visibleServiceSuggestions,
    onSelect: onApplyServiceSuggestion,
    onReorder: onReorderSuggestions,
    canReorder: Boolean(canManageOrders),
    isVisible: isServiceSuggestionsVisible,
  });

  return (
    <section className="create-order-sale-section create-order-sale-services-section">
      <button
        type="button"
        className="order-detail-collapse-button create-order-services-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span>{t('orders.detail.services')}</span>
        <span className="order-detail-collapse-icon" aria-hidden="true">
          {isOpen ? COLLAPSE_ICON_EXPANDED : COLLAPSE_ICON_COLLAPSED}
        </span>
      </button>

      {isOpen ? (
        <>
          <div className="create-order-service-entry-row">
            <label
              className="field create-order-service-search"
              ref={serviceSuggestionsRootRef}
            >
              <span>{t('orders.detail.lineItems.addServicePlaceholder')}</span>
              <input
                value={serviceQuery}
                onChange={(event) => onServiceQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    isServiceSuggestionsVisible &&
                    visibleServiceSuggestions.length > 0
                  ) {
                    if (
                      event.key === 'ArrowDown' ||
                      event.key === 'ArrowUp' ||
                      (event.key === 'Enter' && serviceReorder.activeIndex >= 0)
                    ) {
                      serviceReorder.handleKeyDown(event);
                      return;
                    }
                  }
                }}
                placeholder={t('orders.detail.lineItems.addServicePlaceholder')}
              />
            </label>
            <ServiceSalePriceField
              label={t('orders.create.price')}
              fieldClassName="field sale-item-price-field sale-price-field-labeled"
              tierTogglePlacement="label"
              value={servicePrice}
              onChange={onServicePriceChange}
              service={selectedService}
              priceTier={servicePriceTier}
              onPriceTierChange={onServicePriceTierChange}
              placeholder="0"
              ariaLabel={t('orders.create.price')}
            />
            <label className="field">
              <span>{t('orders.create.qty')}</span>
              <NumberStepper
                min={1}
                value={serviceQuantity}
                onChange={onServiceQuantityChange}
              />
            </label>
            <label className="field">
              <span>{t('orders.create.warranty')}</span>
              <select
                value={serviceWarranty}
                onChange={(event) => onServiceWarrantyChange(event.target.value)}
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
                className="secondary-button create-order-add-service-button"
                onClick={() => void onAddService()}
              >
                {t('orders.detail.lineItems.addService')}
              </button>
            </label>
          </div>

          {isServiceSuggestionsVisible ? (
            <div
              ref={serviceSuggestionsPanelRef}
              className="create-suggestions create-order-service-suggestions"
            >
              {isServiceLookupLoading ? (
                <p>{t('orders.detail.lineItems.searchingServices')}</p>
              ) : null}
              {visibleServiceSuggestions.map((service, index) => (
                <ReorderableSuggestionItem
                  key={service.id}
                  id={service.id}
                  isActive={serviceReorder.activeIndex === index}
                  canReorder={Boolean(canManageOrders)}
                  isFirst={index === 0}
                  isLast={index === visibleServiceSuggestions.length - 1}
                  onSelect={() => onApplyServiceSuggestion(service)}
                  onMoveUp={() => serviceReorder.moveItem(index, 'up')}
                  onMoveDown={() => serviceReorder.moveItem(index, 'down')}
                  onDragStart={(e) => serviceReorder.handleDragStart(e, index)}
                  onDragOver={(e) => serviceReorder.handleDragOver(e, index)}
                  onDrop={(e) => serviceReorder.handleDrop(e, index)}
                  onDragEnd={serviceReorder.handleDragEnd}
                  isDragging={serviceReorder.draggedIndex === index}
                  isDragOver={serviceReorder.dragOverIndex === index}
                  ariaLabel={service.name}
                >
                  <strong>{service.name}</strong>
                  <span>
                    {formatCurrency(service.price)}
                    {service.note ? ` / ${service.note}` : ''}
                  </span>
                </ReorderableSuggestionItem>
              ))}
            </div>
          ) : null}

          {canCreateMissingService ? (
            <button
              type="button"
              className="secondary-button create-order-create-service-button"
              onClick={onOpenCreateService}
            >
              {t('orders.detail.lineItems.addServiceButton')}
            </button>
          ) : null}

          {saleServiceItems.length > 0 ? (
            <table className="create-order-service-items-table">
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('orders.create.price')}</th>
                  <th>{t('orders.create.qty')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {saleServiceItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{formatCurrency(Number(item.price) || 0)}</td>
                    <td>{item.quantity}</td>
                    <td>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onRemoveServiceItem(item.id)}
                      >
                        {t('orders.detail.lineItems.remove')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      ) : null}
    </section>
  );
};