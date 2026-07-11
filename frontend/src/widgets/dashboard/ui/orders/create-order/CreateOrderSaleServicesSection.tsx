import { useTranslation } from 'react-i18next';
import type { ServiceCatalogItem } from '../../../../../entities/service-catalog/model/types';
import {
  PRICE_STEPPER_PRECISION,
  PRICE_STEPPER_STEP,
} from '../../../../../shared/lib/price-stepper';
import { NumberStepper } from '../../../../../shared/ui/NumberStepper';
import { formatCurrency } from '../../../../../shared/lib/format';
import type { SaleServiceOrderItem } from './create-order-card-shared';
import { getWarrantyOptions } from '../workspace/orders-workspace-shared';

const COLLAPSE_ICON_EXPANDED = '\u2303';
const COLLAPSE_ICON_COLLAPSED = '\u2304';

type CreateOrderSaleServicesSectionProps = {
  isOpen: boolean;
  serviceQuery: string;
  servicePrice: string;
  serviceQuantity: string;
  serviceWarranty: string;
  serviceSuggestions: ServiceCatalogItem[];
  isServiceLookupLoading: boolean;
  canCreateMissingService: boolean;
  saleServiceItems: SaleServiceOrderItem[];
  onToggle: () => void;
  onServiceQueryChange: (value: string) => void;
  onServicePriceChange: (value: string) => void;
  onServiceQuantityChange: (value: string) => void;
  onServiceWarrantyChange: (value: string) => void;
  onApplyServiceSuggestion: (service: ServiceCatalogItem) => void;
  onAddService: () => void;
  onOpenCreateService: () => void;
  onRemoveServiceItem: (itemId: string) => void;
};

export const CreateOrderSaleServicesSection = ({
  isOpen,
  serviceQuery,
  servicePrice,
  serviceQuantity,
  serviceWarranty,
  serviceSuggestions,
  isServiceLookupLoading,
  canCreateMissingService,
  saleServiceItems,
  onToggle,
  onServiceQueryChange,
  onServicePriceChange,
  onServiceQuantityChange,
  onServiceWarrantyChange,
  onApplyServiceSuggestion,
  onAddService,
  onOpenCreateService,
  onRemoveServiceItem,
}: CreateOrderSaleServicesSectionProps) => {
  const { t } = useTranslation();
  const warrantyOptions = getWarrantyOptions();
  const visibleServiceSuggestions =
    serviceQuery.trim().length >= 2 ? serviceSuggestions : [];

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
            <label className="field create-order-service-search">
              <span>{t('orders.detail.lineItems.addServicePlaceholder')}</span>
              <input
                value={serviceQuery}
                onChange={(event) => onServiceQueryChange(event.target.value)}
                placeholder={t('orders.detail.lineItems.addServicePlaceholder')}
              />
            </label>
            <label className="field">
              <span>{t('orders.create.price')}</span>
              <NumberStepper
                min={0}
                step={PRICE_STEPPER_STEP}
                precision={PRICE_STEPPER_PRECISION}
                value={servicePrice}
                onChange={onServicePriceChange}
                placeholder="0"
              />
            </label>
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

          {visibleServiceSuggestions.length > 0 || isServiceLookupLoading ? (
            <div className="create-suggestions create-order-service-suggestions">
              {isServiceLookupLoading ? (
                <p>{t('orders.detail.lineItems.searchingServices')}</p>
              ) : null}
              {visibleServiceSuggestions.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className="create-suggestion-item"
                  onClick={() => onApplyServiceSuggestion(service)}
                >
                  <strong>{service.name}</strong>
                  <span>
                    {formatCurrency(service.price)}
                    {service.note ? ` / ${service.note}` : ''}
                  </span>
                </button>
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