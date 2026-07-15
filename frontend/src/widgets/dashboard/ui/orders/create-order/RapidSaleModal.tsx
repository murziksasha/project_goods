import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../../../../entities/product/model/types';
import type { Sale } from '../../../../../entities/sale/model/types';
import {
  createServiceCatalogItem,
  getServiceCatalogItems,
} from '../../../../../entities/service-catalog/api/serviceCatalogApi';
import type { ServiceCatalogItem } from '../../../../../entities/service-catalog/model/types';
import { useWarehouseSettingsQuery } from '../../../../../entities/warehouse-settings/api/warehouseSettingsApi';
import type { ProductSalePriceTier } from '../../../../../entities/product/lib/sale-prices';
import {
  PRICE_STEPPER_PRECISION,
  PRICE_STEPPER_STEP,
} from '../../../../../shared/lib/price-stepper';
import { NumberStepper } from '../../../../../shared/ui/NumberStepper';
import { ProductSalePriceField } from '../../../../../shared/ui/ProductSalePriceField';
import { Modal } from '../../../../../shared/ui/Modal';
import { Button } from '../../../../../shared/ui/Button';
import { createRuntimeId } from '../../../../../shared/lib/runtime-id';
import {
  buildMissingServicePayload,
  shouldCreateMissingServiceOnSubmit,
} from '../../../model/missingService';
import {
  buildRapidSaleStockSuggestions,
  getRapidSaleDraftTotal,
  getRapidSaleOccupiedSerialNumbers,
  validateRapidSaleDraft,
  type RapidSaleDraftItem,
} from '../../../model/rapid-sale-line-items';
import type { CreateOrderProductSuggestion } from '../../../model/create-order-products';
import { normalizeSerialNumber } from '../../../model/order-line-serials';
import { parseDecimalInput } from './create-order-card-shared';
import { getWarrantyOptions } from '../workspace/orders-workspace-shared';
import {
  filterProductsByWarehouse,
  getDefaultWarehouseId,
} from '../../../model/warehouse-serial-filter';
import { WarehouseSelectField } from '../../warehouse/WarehouseSelectField';

type RapidSaleModalProps = {
  products: Product[];
  sales: Sale[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (items: RapidSaleDraftItem[]) => Promise<void>;
  onError: (message: string) => void;
};

export const RapidSaleModal = ({
  products,
  sales,
  isSaving,
  onClose,
  onSubmit,
  onError,
}: RapidSaleModalProps) => {
  const { t } = useTranslation();
  const warrantyOptions = getWarrantyOptions();
  const [draftItems, setDraftItems] = useState<RapidSaleDraftItem[]>([]);

  const [productQuery, setProductQuery] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productPriceTier, setProductPriceTier] =
    useState<ProductSalePriceTier | null>(null);
  const [productQuantity, setProductQuantity] = useState('1');
  const [productWarranty, setProductWarranty] = useState('0');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductName, setSelectedProductName] = useState('');
  const [selectedSerialNumbers, setSelectedSerialNumbers] = useState<string[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<CreateOrderProductSuggestion[]>([]);
  const [isProductLookupLoading, setIsProductLookupLoading] = useState(false);

  const [serviceQuery, setServiceQuery] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceQuantity, setServiceQuantity] = useState('1');
  const [serviceWarranty, setServiceWarranty] = useState('1');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceSuggestions, setServiceSuggestions] = useState<ServiceCatalogItem[]>([]);
  const [isServiceLookupLoading, setIsServiceLookupLoading] = useState(false);
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const serviceSearchInputRef = useRef<HTMLInputElement>(null);
  const warehouseSettingsQuery = useWarehouseSettingsQuery();
  const warehouses = useMemo(
    () => warehouseSettingsQuery.data?.warehouses ?? [],
    [warehouseSettingsQuery.data?.warehouses],
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  useEffect(() => {
    if (!selectedWarehouseId && warehouses.length > 0) {
      setSelectedWarehouseId(getDefaultWarehouseId(warehouses));
    }
  }, [selectedWarehouseId, warehouses]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      productSearchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const warehouseFilteredProducts = useMemo(
    () => filterProductsByWarehouse(products, selectedWarehouseId, warehouses),
    [products, selectedWarehouseId, warehouses],
  );
  const selectedStockProduct = useMemo(
    () =>
      selectedProductId
        ? products.find((product) => product.id === selectedProductId) ?? null
        : null,
    [products, selectedProductId],
  );

  const draftTotal = useMemo(() => getRapidSaleDraftTotal(draftItems), [draftItems]);
  const validationErrorKey = useMemo(() => validateRapidSaleDraft(draftItems), [draftItems]);
  const visibleProductSuggestions =
    productQuery.trim().length >= 2 && !selectedProductId ? productSuggestions : [];
  const visibleServiceSuggestions =
    serviceQuery.trim().length >= 2 && !selectedServiceId ? serviceSuggestions : [];

  useEffect(() => {
    if (productQuery.trim().length < 2 || selectedProductId) {
      setProductSuggestions([]);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      setIsProductLookupLoading(true);
      try {
        const suggestions = buildRapidSaleStockSuggestions({
          products: warehouseFilteredProducts,
          sales,
          query: productQuery,
          draftItems,
          pendingSerialNumbers: selectedSerialNumbers,
        });
        if (isActive) setProductSuggestions(suggestions);
      } finally {
        if (isActive) setIsProductLookupLoading(false);
      }
    }, 200);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    productQuery,
    warehouseFilteredProducts,
    sales,
    selectedProductId,
    draftItems,
    selectedSerialNumbers,
  ]);

  const handleWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
    setProductQuery('');
    setProductPrice('');
    setProductPriceTier(null);
    setProductQuantity('1');
    setProductWarranty('0');
    setSelectedProductId('');
    setSelectedProductName('');
    setSelectedSerialNumbers([]);
    setProductSuggestions([]);
  };

  useEffect(() => {
    if (serviceQuery.trim().length < 2 || selectedServiceId) {
      setServiceSuggestions([]);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsServiceLookupLoading(true);
      try {
        const services = await getServiceCatalogItems(serviceQuery.trim());
        if (isActive) setServiceSuggestions(services.slice(0, 6));
      } catch {
        if (isActive) setServiceSuggestions([]);
      } finally {
        if (isActive) setIsServiceLookupLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [serviceQuery, selectedServiceId]);

  const resetProductEntry = () => {
    setProductQuery('');
    setProductPrice('');
    setProductPriceTier(null);
    setProductQuantity('1');
    setProductWarranty('0');
    setSelectedProductId('');
    setSelectedProductName('');
    setSelectedSerialNumbers([]);
    setProductSuggestions([]);
  };

  const resetServiceEntry = () => {
    setServiceQuery('');
    setServicePrice('');
    setServiceQuantity('1');
    setServiceWarranty('1');
    setSelectedServiceId('');
    setServiceSuggestions([]);
  };

  const addProductDraft = (item: Extract<RapidSaleDraftItem, { kind: 'product' }>) => {
    setDraftItems((current) => [...current, item]);
    resetProductEntry();
    productSearchInputRef.current?.focus();
  };

  const applyProductSuggestion = (suggestion: CreateOrderProductSuggestion) => {
    if (!suggestion.selectable) {
      onError(
        t('orders.create.errors.productCannotBeSelected', {
          reason: suggestion.availabilityLabel,
        }),
      );
      return;
    }

    const serialNumber = normalizeSerialNumber(suggestion.serialNumber);
    const unitPrice = suggestion.price > 0 ? String(suggestion.price) : '0';

    setProductQuery(suggestion.name);
    setSelectedProductId(suggestion.productId);
    setSelectedProductName(suggestion.name);
    setProductPrice(unitPrice);
    setProductPriceTier('retail');
    setProductQuantity('1');
    setProductWarranty(String(suggestion.warrantyPeriod ?? 0));
    setSelectedSerialNumbers(serialNumber ? [serialNumber] : []);
    setProductSuggestions([]);
  };

  const handleAddProduct = () => {
    if (!selectedProductId || selectedProductName.trim().length < 2) {
      onError(t('orders.rapidSale.errors.stockOnly'));
      return;
    }

    const occupiedSerials = new Set(
      getRapidSaleOccupiedSerialNumbers(draftItems),
    );
    const hasDuplicateSerial = selectedSerialNumbers.some((serial) =>
      occupiedSerials.has(normalizeSerialNumber(serial)),
    );
    if (hasDuplicateSerial) {
      onError(t('orders.rapidSale.errors.duplicateSerial'));
      return;
    }

    addProductDraft({
      id: createRuntimeId(),
      kind: 'product',
      productId: selectedProductId,
      name: selectedProductName,
      price: productPrice || '0',
      quantity: productQuantity || '1',
      warrantyPeriod: productWarranty || '0',
      serialNumbers: selectedSerialNumbers,
    });
  };

  const applyServiceSuggestion = (service: ServiceCatalogItem) => {
    setServiceQuery(service.name);
    setServicePrice(String(service.price));
    setServiceQuantity('1');
    setServiceWarranty('1');
    setSelectedServiceId(service.id);
    setServiceSuggestions([]);
  };

  const handleAddService = async () => {
    const normalizedName = serviceQuery.trim();
    if (normalizedName.length < 2) {
      onError(t('orders.rapidSale.errors.serviceName'));
      return;
    }

    let serviceId = selectedServiceId;
    if (
      shouldCreateMissingServiceOnSubmit({
        kind: 'service',
        normalizedName,
        selectedServiceId: serviceId,
        suggestionNames: serviceSuggestions.map((service) => service.name),
      })
    ) {
      try {
        const createdService = await createServiceCatalogItem(
          buildMissingServicePayload(normalizedName, parseDecimalInput(servicePrice) || 0),
        );
        serviceId = createdService.id;
      } catch (error) {
        onError(
          error instanceof Error ? error.message : t('orders.rapidSale.errors.failedCreateService'),
        );
        return;
      }
    }

    setDraftItems((current) => [
      ...current,
      {
        id: createRuntimeId(),
        kind: 'service',
        serviceId: serviceId || undefined,
        name: normalizedName,
        price: servicePrice || '0',
        quantity: serviceQuantity || '1',
        warrantyPeriod: serviceWarranty || '1',
      },
    ]);
    resetServiceEntry();
    serviceSearchInputRef.current?.focus();
  };

  const updateDraftItemPrice = (itemId: string, price: string) => {
    setDraftItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, price } : item)),
    );
  };

  const handleIssued = async () => {
    const errorKey = validateRapidSaleDraft(draftItems);
    if (errorKey) {
      onError(t(errorKey));
      return;
    }

    await onSubmit(draftItems);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (
          productQuery ||
          selectedProductId ||
          serviceQuery ||
          selectedServiceId
        ) {
          resetProductEntry();
          resetServiceEntry();
          productSearchInputRef.current?.focus();
          return;
        }
        if (draftItems.length > 0) {
          setDraftItems([]);
          productSearchInputRef.current?.focus();
          return;
        }
        onClose();
        return;
      }

      if (event.key === 'F4' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        if (!isSaving && !validationErrorKey) {
          void handleIssued();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [
    draftItems.length,
    isSaving,
    onClose,
    productQuery,
    selectedProductId,
    selectedServiceId,
    serviceQuery,
    validationErrorKey,
  ]);

  return (
    <Modal
      isOpen
      title={t('orders.rapidSale.title')}
      onClose={onClose}
      closeLabel={t('common.close')}
      className="rapid-sale-modal"
      bodyClassName="rapid-sale-body"
      closeOnBackdrop={!isSaving}
      closeOnEscape={false}
      initialFocusSelector=".rapid-sale-field-search input"
      footer={
        <>
          {draftItems.length > 0 ? (
            <section className="rapid-sale-items">
              <table className="rapid-sale-items-table">
                <thead>
                  <tr>
                    <th>{t('common.name')}</th>
                    <th>{t('orders.create.price')}</th>
                    <th>{t('orders.create.qty')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.name}
                        {item.kind === 'product' && item.serialNumbers?.length
                          ? ` (${item.serialNumbers.join(', ')})`
                          : ''}
                      </td>
                      <td className="rapid-sale-draft-price-cell">
                        <NumberStepper
                          min={0}
                          step={PRICE_STEPPER_STEP}
                          precision={PRICE_STEPPER_PRECISION}
                          value={item.price}
                          onChange={(nextPrice) =>
                            updateDraftItemPrice(item.id, nextPrice)
                          }
                          ariaLabel={`${item.name} ${t('orders.create.price')}`}
                          placeholder="0"
                          disabled={isSaving}
                          className="line-item-inline-input rapid-sale-draft-price"
                        />
                      </td>
                      <td>{item.quantity}</td>
                      <td>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            setDraftItems((current) =>
                              current.filter((draft) => draft.id !== item.id),
                            )
                          }
                        >
                          {t('orders.detail.lineItems.remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="rapid-sale-total">
                {t('orders.rapidSale.total', {
                  amount: Math.round(draftTotal * 100) / 100,
                })}
              </p>
            </section>
          ) : null}
          <footer className="rapid-sale-footer catalog-edit-footer">
            <p
              className="rapid-sale-shortcuts"
              aria-label={t('orders.rapidSale.shortcutsLabel')}
            >
              {t('orders.rapidSale.shortcuts')}
            </p>
            <div className="rapid-sale-footer-actions">
              <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                className="rapid-sale-issued-button"
                disabled={isSaving || Boolean(validationErrorKey)}
                onClick={() => void handleIssued()}
              >
                {isSaving
                  ? t('orders.create.saving')
                  : t('orders.rapidSale.issued')}
              </Button>
            </div>
          </footer>
        </>
      }
    >
          <section className="rapid-sale-section">
            <h3>{t('orders.rapidSale.products')}</h3>
            <WarehouseSelectField
              warehouses={warehouses}
              value={selectedWarehouseId}
              onChange={handleWarehouseChange}
              disabled={isSaving || warehouseSettingsQuery.isLoading}
              className="rapid-sale-warehouse-field"
            />
            <div className="rapid-sale-entry-row">
              <label className="field rapid-sale-field-search">
                <span>{t('orders.create.productSearchPlaceholder')}</span>
                <input
                  ref={productSearchInputRef}
                  value={productQuery}
                  onChange={(event) => {
                    setProductQuery(event.target.value);
                    setSelectedProductId('');
                    setSelectedProductName('');
                    setSelectedSerialNumbers([]);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    if (selectedProductId) {
                      handleAddProduct();
                      return;
                    }
                    const firstSelectable = visibleProductSuggestions.find(
                      (suggestion) => suggestion.selectable,
                    );
                    if (firstSelectable) {
                      applyProductSuggestion(firstSelectable);
                    }
                  }}
                  placeholder={t('orders.create.productSearchPlaceholder')}
                />
              </label>
              <ProductSalePriceField
                label={t('orders.create.price')}
                fieldClassName="field sale-price-field-labeled rapid-sale-price-field"
                tierTogglePlacement="label"
                value={productPrice}
                onChange={setProductPrice}
                product={selectedStockProduct}
                priceTier={productPriceTier}
                onPriceTierChange={setProductPriceTier}
                step={PRICE_STEPPER_STEP}
                precision={PRICE_STEPPER_PRECISION}
                placeholder="0"
                ariaLabel={t('orders.rapidSale.productPrice')}
              />
              <label className="field">
                <span>{t('orders.create.qty')}</span>
                <NumberStepper
                  min={1}
                  value={productQuantity}
                  onChange={setProductQuantity}
                  disabled={selectedSerialNumbers.length > 0}
                  ariaLabel={t('orders.rapidSale.productQuantity')}
                />
              </label>
              <label className="field">
                <span>{t('orders.create.warranty')}</span>
                <select
                  value={productWarranty}
                  onChange={(event) => setProductWarranty(event.target.value)}
                >
                  {warrantyOptions.map((option) => (
                    <option key={option.value} value={String(option.value)}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field rapid-sale-entry-action">
                <span aria-hidden="true">&nbsp;</span>
                <button
                  type="button"
                  className="secondary-button rapid-sale-entry-button"
                  aria-label={t('orders.rapidSale.addProduct')}
                  onClick={handleAddProduct}
                  disabled={!selectedProductId}
                >
                  {t('orders.rapidSale.addProduct')}
                </button>
              </div>
            </div>
            {visibleProductSuggestions.length > 0 || isProductLookupLoading ? (
              <div className="create-suggestions rapid-sale-suggestions">
                {isProductLookupLoading ? (
                  <p>{t('orders.create.searchingProducts')}</p>
                ) : null}
                {visibleProductSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="create-suggestion-item"
                    aria-label={suggestion.name}
                    disabled={!suggestion.selectable}
                    title={suggestion.selectable ? undefined : suggestion.availabilityLabel}
                    onClick={() => applyProductSuggestion(suggestion)}
                  >
                    <strong>{suggestion.name}</strong>
                    <span>
                      {`${suggestion.article || '-'} / ${suggestion.serialNumber || '-'} / ${suggestion.availabilityLabel}`}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rapid-sale-section">
            <h3>{t('orders.rapidSale.services')}</h3>
            <div className="rapid-sale-entry-row">
              <label className="field rapid-sale-field-search">
                <span>{t('orders.rapidSale.serviceSearch')}</span>
                <input
                  ref={serviceSearchInputRef}
                  value={serviceQuery}
                  onChange={(event) => {
                    setServiceQuery(event.target.value);
                    setSelectedServiceId('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    if (selectedServiceId || serviceQuery.trim().length >= 2) {
                      void handleAddService();
                      return;
                    }
                    if (visibleServiceSuggestions[0]) {
                      applyServiceSuggestion(visibleServiceSuggestions[0]);
                    }
                  }}
                  placeholder={t('orders.rapidSale.serviceSearch')}
                />
              </label>
              <label className="field">
                <span>{t('orders.create.price')}</span>
                <NumberStepper
                  min={0}
                  step={PRICE_STEPPER_STEP}
                  precision={PRICE_STEPPER_PRECISION}
                  value={servicePrice}
                  onChange={setServicePrice}
                  placeholder="0"
                />
              </label>
              <label className="field">
                <span>{t('orders.create.qty')}</span>
                <NumberStepper min={1} value={serviceQuantity} onChange={setServiceQuantity} />
              </label>
              <label className="field">
                <span>{t('orders.create.warranty')}</span>
                <select
                  value={serviceWarranty}
                  onChange={(event) => setServiceWarranty(event.target.value)}
                >
                  {warrantyOptions.map((option) => (
                    <option key={option.value} value={String(option.value)}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field rapid-sale-entry-action">
                <span aria-hidden="true">&nbsp;</span>
                <button
                  type="button"
                  className="secondary-button rapid-sale-entry-button"
                  aria-label={t('orders.rapidSale.addService')}
                  onClick={() => void handleAddService()}
                >
                  {t('orders.rapidSale.addService')}
                </button>
              </div>
            </div>
            {visibleServiceSuggestions.length > 0 || isServiceLookupLoading ? (
              <div className="create-suggestions rapid-sale-suggestions">
                {isServiceLookupLoading ? (
                  <p>{t('orders.rapidSale.searchingServices')}</p>
                ) : null}
                {visibleServiceSuggestions.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    className="create-suggestion-item"
                    onClick={() => applyServiceSuggestion(service)}
                  >
                    <strong>{service.name}</strong>
                    <span>{service.price}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
    </Modal>
  );
};