import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Sale } from '../../../../../entities/sale/model/types';
import {
  createServiceCatalogItem,
  getServiceCatalogItems,
  updateServiceCatalogItem,
} from '../../../../../entities/service-catalog/api/serviceCatalogApi';
import type { ServiceCatalogItem } from '../../../../../entities/service-catalog/model/types';
import {
  initialServiceCatalogForm,
  toServiceCatalogForm,
} from '../../../../../entities/service-catalog/model/forms';
import { getProducts } from '../../../../../entities/product/api/productApi';
import {
  createSupplier,
  getSuppliers,
} from '../../../../../entities/supplier/api/supplierApi';
import type {
  Supplier,
  SupplierFormValues,
} from '../../../../../entities/supplier/model/types';
import type { SupplierOrderFormValues } from '../../../../../entities/supplier-order/model/types';
import { createSupplierOrder } from '../../../../../entities/supplier-order/api/supplierOrderApi';
import type {
  Product,
  ProductModelUpdatePayload,
} from '../../../../../entities/product/model/types';
import type { CatalogProduct } from '../../../../../entities/catalog-product/model/types';
import { getWarehouseSettings } from '../../../../../entities/warehouse-settings/api/warehouseSettingsApi';
import type { WarehouseItem } from '../../../../../entities/warehouse-settings/model/types';
import {
  formatProductSalePrice,
  getProductSalePriceByTier,
  getRetailSalePrice,
  hasWholesaleSalePrice,
  matchesProductSalePriceTier,
  type ProductSalePriceTier,
} from '../../../../../entities/product/lib/sale-prices';
import { NumberStepper } from '../../../../../shared/ui/NumberStepper';
import { ProductSalePriceField } from '../../../../../shared/ui/ProductSalePriceField';
import { ProductSalePriceTierToggle } from '../../../../../shared/ui/ProductSalePriceTierToggle';
import { parseDecimal } from '../../../../../shared/lib/decimal';
import { formatCurrency } from '../../../../../shared/lib/format';
import type { PrintForm } from '../../../../../entities/settings/model/types';
import {
  SupplierOrderModal,
  type SupplierOrderModalSubmitPayload,
} from '../modals/SupplierOrderModal';
import { ProductModelModal } from '../modals/ProductModelModal';
import { SerialBindModal } from '../modals/SerialBindModal';
import {
  buildOrderDetailProductSuggestions,
  findSelectableStockProductByName,
} from '../../../model/create-order-products';
import {
  buildMissingServicePayload,
  shouldCreateMissingServiceOnSubmit,
} from '../../../model/missingService';
import { canRemoveLineItemAfterPayment } from '../../../model/line-item-ops';
import {
  buildSerializedProductLineItem,
  getProductSerialAvailability,
  getSaleSerialUsage,
  normalizeSerialNumber,
  type ProductSerialAvailability,
  type SerialUsage,
} from '../../../model/order-line-serials';
import {
  getDiscount,
  getWarrantyOptions,
  isProductAvailableForOrder,
  normalizeProductLookupValue,
  stockLockedRepairStatuses,
  withSupplierOrderLinkNote,
  type OrderLineItem,
  type OrderLineItemKind,
  type OrderStatus,
  type RepairStatus,
} from '../workspace/orders-workspace-shared';
import { OrderDetailCatalogServiceEditorModal } from './OrderDetailCatalogServiceEditorModal';

export type OrderDetailLineItemsPanelProps = {
  kind: OrderLineItemKind;
  sales: Sale[];
  currentSaleId: string;
  currentSaleRecordNumber?: string;
  currentClientId: string;
  currentStatus: OrderStatus;
  items: OrderLineItem[];
  allItems: OrderLineItem[];
  products: Product[];
  printForms: PrintForm[];
  catalogProducts: CatalogProduct[];
  onAddItem: (item: Omit<OrderLineItem, 'id'>) => void;
  onReplaceItem: (
    itemId: string,
    itemIndex: number | undefined,
    items: Array<Omit<OrderLineItem, 'id'>>,
  ) => void;
  onRemoveItem: (itemId: string, itemIndex?: number) => void;
  onUpdateItem: (
    itemId: string,
    itemIndex: number | undefined,
    patch: Partial<
      Pick<
        OrderLineItem,
        | 'name'
        | 'productId'
        | 'serviceId'
        | 'price'
        | 'quantity'
        | 'warrantyPeriod'
        | 'serialNumbers'
      >
    >,
  ) => void;
  onReturnItem: (item: OrderLineItem) => void;
  paidAmount: number;
  discount: ReturnType<typeof getDiscount>;
  isReadOnly: boolean;
  onSupplierOrderCreated: () => Promise<void>;
  onUpdateProductModel: (
    payload: ProductModelUpdatePayload,
  ) => Promise<boolean>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

type ProductEntrySuggestion =
  | {
      type: 'catalog';
      catalogProduct: CatalogProduct;
      price: number;
      warrantyPeriod: number;
    }
  | { type: 'stock'; product: Product; warehouseName: string };

export const OrderDetailLineItemsPanel = ({
  kind,
  sales,
  currentSaleId,
  currentSaleRecordNumber,
  currentClientId,
  currentStatus,
  items,
  allItems,
  products,
  printForms,
  catalogProducts,
  onAddItem,
  onReplaceItem,
  onRemoveItem,
  onUpdateItem,
  onReturnItem,
  paidAmount,
  discount,
  isReadOnly,
  onSupplierOrderCreated,
  onUpdateProductModel,
  onError,
  onSuccess,
}: OrderDetailLineItemsPanelProps) => {
  const { t } = useTranslation();
  const warrantyOptions = getWarrantyOptions();
  const isProductKind = kind === 'product';

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [priceTier, setPriceTier] =
    useState<ProductSalePriceTier | null>(null);
  const [priceTierByItemId, setPriceTierByItemId] = useState<
    Record<string, ProductSalePriceTier | null>
  >({});
  const [activePriceContext, setActivePriceContext] = useState<
    'entry' | string
  >('entry');
  const [quantity, setQuantity] = useState('1');
  const [warrantyPeriod, setWarrantyPeriod] = useState(
    kind === 'service' ? '1' : '0',
  );
  const [serviceSuggestions, setServiceSuggestions] = useState<
    ServiceCatalogItem[]
  >([]);
  const [productSuggestions, setProductSuggestions] = useState<
    ProductEntrySuggestion[]
  >([]);
  const [selectedServiceId, setSelectedServiceId] = useState<
    string | undefined
  >();
  const [selectedProductId, setSelectedProductId] = useState<
    string | undefined
  >();
  const productsById = useMemo(
    () =>
      Object.fromEntries(
        products.map((product) => [product.id, product]),
      ),
    [products],
  );
  const selectedStockProduct = useMemo(
    () =>
      selectedProductId
        ? (productsById[selectedProductId] ?? null)
        : null,
    [productsById, selectedProductId],
  );
  const [selectedCatalogProductId, setSelectedCatalogProductId] =
    useState<string | undefined>();
  const [isServiceLookupLoading, setIsServiceLookupLoading] =
    useState(false);
  const [isProductLookupLoading, setIsProductLookupLoading] =
    useState(false);
  const [selectedService, setSelectedService] =
    useState<ServiceCatalogItem | null>(null);
  const [serviceForm, setServiceForm] = useState(
    initialServiceCatalogForm,
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(
    null,
  );
  const [isCatalogSaving, setIsCatalogSaving] = useState(false);
  const [isCreateServiceOpen, setIsCreateServiceOpen] =
    useState(false);
  const [createServiceForm, setCreateServiceForm] = useState(
    initialServiceCatalogForm,
  );
  const [isCreateServiceSaving, setIsCreateServiceSaving] =
    useState(false);
  const [serialsEditingItem, setSerialsEditingItem] =
    useState<OrderLineItem | null>(null);
  const [serialBindWarehouses, setSerialBindWarehouses] = useState<
    WarehouseItem[]
  >([]);
  const [productLookupWarehouses, setProductLookupWarehouses] =
    useState<WarehouseItem[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<
    Record<string, string>
  >({});
  const [isSupplierOrderModalOpen, setIsSupplierOrderModalOpen] =
    useState(false);
  const [supplierOrderProductName, setSupplierOrderProductName] =
    useState('');
  const [
    supplierOrderInitialQuantity,
    setSupplierOrderInitialQuantity,
  ] = useState(1);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isSuppliersLoading, setIsSuppliersLoading] = useState(false);
  const [availableSerialProducts, setAvailableSerialProducts] =
    useState<Product[]>([]);
  const [isSerialLookupLoading, setIsSerialLookupLoading] =
    useState(false);
  const [productModelContext, setProductModelContext] = useState<{
    name: string;
    printProduct: Product | null;
  } | null>(null);
  const [productModelWarehouses, setProductModelWarehouses] =
    useState<WarehouseItem[]>([]);
  const serviceLookupQuery = kind === 'service' ? name.trim() : '';
  const hasExactServiceSuggestion = serviceSuggestions.some(
    (service) =>
      service.name.trim().toLowerCase() ===
      serviceLookupQuery.toLowerCase(),
  );
  const canCreateMissingService =
    kind === 'service' &&
    serviceLookupQuery.length >= 2 &&
    !isServiceLookupLoading &&
    serviceSuggestions.length === 0 &&
    !hasExactServiceSuggestion;
  const serialUsage = useMemo((): SerialUsage => {
    if (!isProductKind)
      return { current: new Set(), other: new Set() };
    return getSaleSerialUsage(sales, currentSaleId);
  }, [isProductKind, currentSaleId, sales]);
  const productsBySerial = useMemo(() => {
    if (!isProductKind) return new Map<string, Product>();
    const map = new Map<string, Product>();
    products.forEach((product) => {
      const serial = normalizeSerialNumber(product.serialNumber);
      if (serial && !map.has(serial)) {
        map.set(serial, product);
      }
    });
    return map;
  }, [isProductKind, products]);
  useEffect(() => {
    setPriceDrafts((current) => {
      const itemIds = new Set(items.map((item) => item.id));
      const nextEntries = Object.entries(current).filter(([itemId]) =>
        itemIds.has(itemId),
      );

      if (nextEntries.length === Object.keys(current).length)
        return current;

      return Object.fromEntries(nextEntries);
    });
  }, [items]);
  const occupiedSerials = useMemo(() => {
    if (!isProductKind) return new Set<string>();

    const occupied = new Set<string>();

    sales.forEach((candidateSale) => {
      const saleLevelSerial = normalizeSerialNumber(
        candidateSale.product?.serialNumber,
      );
      if (saleLevelSerial) {
        occupied.add(saleLevelSerial);
      }

      (candidateSale.lineItems ?? []).forEach((lineItem) => {
        if (lineItem.kind !== 'product') return;

        const isCurrentEditingLine =
          serialsEditingItem &&
          candidateSale.id === currentSaleId &&
          lineItem.id === serialsEditingItem.id;
        if (isCurrentEditingLine) return;

        (lineItem.serialNumbers ?? [])
          .map(normalizeSerialNumber)
          .filter(Boolean)
          .forEach((serial) => occupied.add(serial));
      });
    });

    return occupied;
  }, [isProductKind, currentSaleId, sales, serialsEditingItem]);
  const getProductSuggestionState = useCallback(
    (product: Product): ProductSerialAvailability => {
      if (!isProductKind)
        return {
          labelKey: 'orders.serialAvailability.free',
          selectable: true,
        };
      return getProductSerialAvailability(product, serialUsage);
    },
    [isProductKind, serialUsage],
  );
  const canRemoveItemAfterPayment = (item: OrderLineItem) =>
    canRemoveLineItemAfterPayment(
      allItems,
      item.id,
      undefined,
      paidAmount,
      discount,
    );
  const canRemoveServiceItem = (item: OrderLineItem) =>
    !isReadOnly && canRemoveItemAfterPayment(item);
  const isIssuedSale = currentStatus === 'issued';
  const canDirectRemoveProductItem = (item: OrderLineItem) =>
    item.kind === 'product' &&
    !isReadOnly &&
    canRemoveItemAfterPayment(item) &&
    (item.serialNumbers ?? []).length === 0;
  const isRepairFinalStockStatus = stockLockedRepairStatuses.has(
    currentStatus as RepairStatus,
  );
  const canReturnIssuedProductItem = (item: OrderLineItem) =>
    item.kind === 'product' &&
    (isIssuedSale || isRepairFinalStockStatus) &&
    (item.serialNumbers ?? []).length > 0;
  const getProductActionBlockedReason = (item: OrderLineItem) => {
    if (canDirectRemoveProductItem(item)) return '';
    if (canReturnIssuedProductItem(item)) return '';
    if (isIssuedSale && (item.serialNumbers ?? []).length === 0) {
      return t('orders.messages.errors.bindSerialBeforeReturnDetail');
    }
    if (isReadOnly) {
      return t('orders.messages.errors.useReturnFlow');
    }
    if (!canRemoveItemAfterPayment(item)) {
      return t('orders.messages.errors.refundBeforeRemoveItem');
    }
    if ((item.serialNumbers ?? []).length > 0) {
      return t('orders.messages.errors.unbindSerialsFirst');
    }
    return t('orders.messages.errors.actionUnavailable');
  };

  const openSupplierOrderModalForSerialItem = async () => {
    if (!serialsEditingItem) return;
    setIsSuppliersLoading(true);
    try {
      const supplierData = await getSuppliers('');
      setSuppliers(supplierData);
      setSupplierOrderProductName(serialsEditingItem.name.trim());
      setSupplierOrderInitialQuantity(
        Math.max(1, Math.floor(serialsEditingItem.quantity)),
      );
      setIsSupplierOrderModalOpen(true);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedLoadSuppliers'),
      );
    } finally {
      setIsSuppliersLoading(false);
    }
  };

  const handleSerialBindSave = (uniqueSerials: string[]) => {
    if (!serialsEditingItem) return;

    if (uniqueSerials.length > serialsEditingItem.quantity) {
      onError(t('orders.messages.errors.serialCountExceedsQty'));
      return;
    }

    const conflictingSerials = uniqueSerials.filter((serial) =>
      occupiedSerials.has(serial),
    );
    if (conflictingSerials.length > 0) {
      onError(
        t('orders.messages.errors.serialAlreadyLinked', {
          serials: conflictingSerials.join(', '),
        }),
      );
      return;
    }

    const serialProducts = uniqueSerials.map((serial) => {
      const matchedProduct = products.find(
        (candidate) =>
          normalizeSerialNumber(candidate.serialNumber) === serial,
      );
      return { serial, product: matchedProduct };
    });
    const missingSerials = serialProducts
      .filter(({ product }) => !product)
      .map(({ serial }) => serial);
    if (missingSerials.length > 0) {
      onError(
        t('orders.messages.errors.serialNotInStock', {
          serials: missingSerials.join(', '),
        }),
      );
      return;
    }

    const unavailableSerials = serialProducts
      .filter(({ product }) => {
        if (!product) return false;
        if (
          product.id === (serialsEditingItem.productId ?? '').trim()
        ) {
          return false;
        }
        return !isProductAvailableForOrder(product);
      })
      .map(({ serial }) => serial);
    if (unavailableSerials.length > 0) {
      onError(
        t('orders.messages.errors.serialNoFreeStock', {
          serials: unavailableSerials.join(', '),
        }),
      );
      return;
    }

    const shouldSplitSerializedLine =
      serialsEditingItem.quantity > 1 || uniqueSerials.length > 1;
    if (shouldSplitSerializedLine) {
      onReplaceItem(
        serialsEditingItem.id,
        undefined,
        serialProducts.map(({ serial, product }) => ({
          ...(product
            ? buildSerializedProductLineItem({
                product,
                price: serialsEditingItem.price,
                warrantyPeriod: serialsEditingItem.warrantyPeriod,
              })
            : {
                kind: 'product' as const,
                productId: undefined,
                name: serialsEditingItem.name,
                price: serialsEditingItem.price,
                quantity: 1,
                warrantyPeriod: serialsEditingItem.warrantyPeriod,
                serialNumbers: [serial],
              }),
        })),
      );
      onSuccess(t('orders.messages.success.serialsUpdated'));
      setSerialsEditingItem(null);
      return;
    }

    onUpdateItem(serialsEditingItem.id, undefined, {
      productId:
        uniqueSerials.length > 0
          ? (serialProducts[0]?.product?.id ??
            serialsEditingItem.productId)
          : undefined,
      name:
        serialProducts[0]?.product?.name ?? serialsEditingItem.name,
      quantity: 1,
      serialNumbers: uniqueSerials,
    });
    onSuccess(t('orders.messages.success.serialsUpdated'));
    setSerialsEditingItem(null);
  };

  const handleCreateSupplier = async (
    payload: SupplierFormValues,
  ) => {
    try {
      const created = await createSupplier(payload);
      setSuppliers((current) => [created, ...current]);
      return true;
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedCreateSupplier'),
      );
      return false;
    }
  };

  const handleSubmitSupplierOrder = async (
    payload: SupplierOrderModalSubmitPayload,
  ) => {
    const orderBaseId = `SO-${Date.now()}`;
    const createPayload: SupplierOrderFormValues = {
      supplierId: payload.supplierId,
      deliveryDate: payload.deliveryDate,
      supplyType: payload.supplyType,
      number: payload.number.trim() || orderBaseId,
      note: withSupplierOrderLinkNote(
        payload.note,
        currentSaleRecordNumber ?? currentSaleId,
        currentClientId,
      ),
      createdBy: t('common.administrator'),
      orderBaseId,
      status: 'request',
      paymentStatus: 'pending',
      items: payload.items,
    };
    await createSupplierOrder(createPayload);
    await onSupplierOrderCreated();
    onSuccess(t('orders.messages.success.supplierOrderCreated'));
  };

  useEffect(() => {
    if (!isProductKind) {
      setProductLookupWarehouses([]);
      return;
    }

    let isActive = true;
    void getWarehouseSettings()
      .then((settings) => {
        if (isActive) setProductLookupWarehouses(settings.warehouses);
      })
      .catch(() => {
        if (isActive) setProductLookupWarehouses([]);
      });

    return () => {
      isActive = false;
    };
  }, [isProductKind]);

  useEffect(() => {
    if (!serialsEditingItem) {
      setSerialBindWarehouses([]);
      return;
    }

    let isActive = true;
    void getWarehouseSettings()
      .then((settings) => {
        if (isActive) setSerialBindWarehouses(settings.warehouses);
      })
      .catch(() => {
        if (isActive) setSerialBindWarehouses([]);
      });

    return () => {
      isActive = false;
    };
  }, [serialsEditingItem]);

  useEffect(() => {
    if (!isProductKind || !serialsEditingItem) {
      setAvailableSerialProducts([]);
      setIsSerialLookupLoading(false);
      return;
    }

    let isActive = true;
    const normalizeNameForMatch = (value: string) =>
      normalizeProductLookupValue(value)
        .replace(/\([^)]*\)/g, '')
        .replace(/[^a-z0-9\u0400-\u04ff\s-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const loadAvailableSerials = async () => {
      setIsSerialLookupLoading(true);
      try {
        const lineProductId =
          serialsEditingItem.quantity === 1 &&
          (serialsEditingItem.serialNumbers ?? []).length > 0
            ? (serialsEditingItem.productId?.trim() ?? '')
            : '';
        const normalizedLineName = normalizeNameForMatch(
          serialsEditingItem.name,
        );
        const products = lineProductId
          ? await getProducts('')
          : await getProducts(serialsEditingItem.name);
        if (!isActive) return;

        const filtered = products.filter((product) => {
          if (!product.isActive) return false;
          if (!product.serialNumber?.trim()) return false;
          if (product.freeQuantity <= 0) return false;
          if (lineProductId) {
            return product.id === lineProductId;
          }
          return (
            normalizeNameForMatch(product.name) === normalizedLineName
          );
        });

        const sorted = [...filtered]
          .filter((product) => {
            const serial = normalizeSerialNumber(
              product.serialNumber,
            );
            if (!serial) return false;
            return !occupiedSerials.has(serial);
          })
          .sort((first, second) => {
            const firstTime = new Date(
              first.purchaseDate ?? first.createdAt,
            ).getTime();
            const secondTime = new Date(
              second.purchaseDate ?? second.createdAt,
            ).getTime();
            return firstTime - secondTime;
          });
        setAvailableSerialProducts(sorted);
      } catch {
        if (isActive) setAvailableSerialProducts([]);
      } finally {
        if (isActive) setIsSerialLookupLoading(false);
      }
    };

    void loadAvailableSerials();

    return () => {
      isActive = false;
    };
  }, [isProductKind, occupiedSerials, serialsEditingItem]);

  useEffect(() => {
    setWarrantyPeriod(kind === 'service' ? '1' : '0');
  }, [kind]);

  const getCatalogDefaults = useCallback(
    (catalogProduct: CatalogProduct) => {
      const matchingStockProduct = products.find(
        (product) =>
          normalizeProductLookupValue(product.name) ===
          normalizeProductLookupValue(catalogProduct.name),
      );
      return {
        price: matchingStockProduct
          ? getRetailSalePrice(matchingStockProduct)
          : 0,
        warrantyPeriod: matchingStockProduct?.warrantyPeriod ?? 0,
      };
    },
    [products],
  );

  useEffect(() => {
    if (
      kind !== 'product' ||
      name.trim().length < 2 ||
      Boolean(selectedProductId) ||
      Boolean(selectedCatalogProductId)
    ) {
      setProductSuggestions([]);
      setIsProductLookupLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsProductLookupLoading(true);
      const suggestions = buildOrderDetailProductSuggestions({
        products,
        catalogProducts,
        sales,
        query: name,
        warehouses: productLookupWarehouses,
        limit: 8,
        currentSaleId,
      });
      const mappedSuggestions: ProductEntrySuggestion[] = [];
      suggestions.forEach((suggestion) => {
        if (suggestion.source === 'stock') {
          const stockProduct = products.find(
            (product) => product.id === suggestion.productId,
          );
          if (stockProduct) {
            mappedSuggestions.push({
              type: 'stock',
              product: stockProduct,
              warehouseName: suggestion.warehouseName ?? '-',
            });
          }
          return;
        }

        const catalogProduct = catalogProducts.find(
          (product) => product.id === suggestion.catalogProductId,
        );
        if (catalogProduct) {
          mappedSuggestions.push({
            type: 'catalog',
            catalogProduct,
            ...getCatalogDefaults(catalogProduct),
          });
        }
      });
      setProductSuggestions(mappedSuggestions);
      setIsProductLookupLoading(false);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    catalogProducts,
    currentSaleId,
    getCatalogDefaults,
    kind,
    name,
    productLookupWarehouses,
    products,
    sales,
    selectedCatalogProductId,
    selectedProductId,
  ]);

  useEffect(() => {
    if (
      kind !== 'service' ||
      serviceLookupQuery.length < 2 ||
      Boolean(selectedServiceId)
    ) {
      setServiceSuggestions([]);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsServiceLookupLoading(true);
      try {
        const services = await getServiceCatalogItems(
          serviceLookupQuery,
        );
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
  }, [kind, selectedServiceId, serviceLookupQuery]);

  const applyServiceSuggestion = (service: ServiceCatalogItem) => {
    setName(service.name);
    setPrice(String(service.price));
    setQuantity('1');
    setWarrantyPeriod('1');
    setSelectedServiceId(service.id);
    setServiceSuggestions([]);
  };

  const applyProductSuggestion = (
    suggestion: ProductEntrySuggestion,
  ) => {
    if (suggestion.type === 'catalog') {
      const matchingStock = findSelectableStockProductByName({
        products,
        catalogName: suggestion.catalogProduct.name,
        sales,
        currentSaleId,
      });

      if (matchingStock) {
        const suggestedPrice = getRetailSalePrice(matchingStock);

        setName(matchingStock.name);
        setPrice(String(suggestedPrice));
        setPriceTier('retail');
        setQuantity('1');
        setWarrantyPeriod(String(matchingStock.warrantyPeriod ?? 0));
        setSelectedProductId(matchingStock.id);
        setSelectedCatalogProductId(undefined);
        setProductSuggestions([]);
        return;
      }

      setName(suggestion.catalogProduct.name);
      setPrice(String(suggestion.price));
      setPriceTier(null);
      setWarrantyPeriod(String(suggestion.warrantyPeriod));
      setSelectedCatalogProductId(suggestion.catalogProduct.id);
      setSelectedProductId(undefined);
      setProductSuggestions([]);
      return;
    }

    const { product } = suggestion;
    const state = getProductSuggestionState(product);
    if (!state.selectable) {
      onError(
        t('orders.messages.errors.productNotSelectable', {
          reason: t(state.labelKey),
        }),
      );
      return;
    }
    const suggestedPrice = getRetailSalePrice(product);
    const serial = normalizeSerialNumber(product.serialNumber);

    if (serial) {
      onAddItem({
        ...buildSerializedProductLineItem({
          product,
          price: suggestedPrice,
          warrantyPeriod: 0,
        }),
      });
      setName('');
      setPrice('');
      setQuantity('1');
      setWarrantyPeriod('0');
      setSelectedProductId(undefined);
      setSelectedCatalogProductId(undefined);
      setProductSuggestions([]);
      onSuccess(
        t('orders.messages.success.productWithSerialAdded', {
          name: product.name,
          serial,
        }),
      );
      return;
    }

    setName(product.name);
    setPrice(String(suggestedPrice));
    setPriceTier('retail');
    setQuantity('1');
    setWarrantyPeriod('0');
    setSelectedProductId(product.id);
    setSelectedCatalogProductId(undefined);
    setProductSuggestions([]);
  };

  const openCreateServiceModal = () => {
    setCreateServiceForm({
      ...initialServiceCatalogForm,
      name: serviceLookupQuery,
      price,
    });
    setIsCreateServiceOpen(true);
  };

  const saveCreatedService = async () => {
    setIsCreateServiceSaving(true);
    try {
      const createdService =
        await createServiceCatalogItem(createServiceForm);
      setName(createdService.name);
      setPrice(String(createdService.price));
      setQuantity('1');
      setWarrantyPeriod('1');
      setSelectedServiceId(createdService.id);
      setServiceSuggestions([createdService]);
      setIsCreateServiceOpen(false);
      onSuccess(t('orders.messages.success.serviceSaved'));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedSaveService'),
      );
    } finally {
      setIsCreateServiceSaving(false);
    }
  };

  const openProductModelModal = async (
    name: string,
    printProduct: Product | null,
  ) => {
    const settings = await getWarehouseSettings();
    setProductModelWarehouses(settings.warehouses);
    setProductModelContext({ name, printProduct });
  };

  const openLineItemModal = async (item: OrderLineItem) => {
    setEditingItemId(item.id);
    try {
      if (item.kind === 'product') {
        await openProductModelModal(item.name, null);
        return;
      }

      const services = await getServiceCatalogItems(item.name);
      const service =
        services.find(
          (candidate) => candidate.id === item.serviceId,
        ) ??
        services.find((candidate) => candidate.name === item.name) ??
        null;
      if (!service) {
        onError(t('orders.messages.errors.serviceNotFound'));
        return;
      }
      setSelectedService(service);
      setServiceForm(toServiceCatalogForm(service));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedLoadCatalogItem'),
      );
    }
  };

  const saveSelectedService = async () => {
    if (!selectedService || !editingItemId) return;

    setIsCatalogSaving(true);
    try {
      const updatedService = await updateServiceCatalogItem(
        selectedService.id,
        serviceForm,
      );
      setSelectedService(updatedService);
      setServiceForm(toServiceCatalogForm(updatedService));
      onUpdateItem(editingItemId, undefined, {
        name: updatedService.name,
        serviceId: updatedService.id,
        price: updatedService.price,
        warrantyPeriod: 1,
      });
      onSuccess(t('orders.messages.success.serviceUpdated'));
      setSelectedService(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedUpdateService'),
      );
    } finally {
      setIsCatalogSaving(false);
    }
  };

  const submitItem = async () => {
    const normalizedName = name.trim();
    const normalizedPrice = parseDecimal(price);
    const normalizedQuantity = Number(quantity);

    if (
      !normalizedName ||
      !Number.isFinite(normalizedPrice) ||
      normalizedPrice < 0 ||
      !Number.isFinite(normalizedQuantity) ||
      normalizedQuantity <= 0
    ) {
      return;
    }

    let nextServiceId =
      kind === 'service'
        ? (selectedServiceId ??
          serviceSuggestions.find(
            (service) => service.name === normalizedName,
          )?.id)
        : undefined;

    if (
      shouldCreateMissingServiceOnSubmit({
        kind,
        normalizedName,
        selectedServiceId: nextServiceId,
        suggestionNames: serviceSuggestions.map(
          (service) => service.name,
        ),
      })
    ) {
      try {
        const createdService = await createServiceCatalogItem(
          buildMissingServicePayload(normalizedName, normalizedPrice),
        );
        nextServiceId = createdService.id;
        setServiceSuggestions([createdService]);
        onSuccess(t('orders.messages.success.serviceSaved'));
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : t('orders.messages.errors.failedSaveService'),
        );
        return;
      }
    }
    const suggestedStockProduct = productSuggestions.find(
      (
        candidate,
      ): candidate is Extract<
        ProductEntrySuggestion,
        { type: 'stock' }
      > =>
        candidate.type === 'stock' &&
        candidate.product.name === normalizedName,
    );
    const selectedProduct =
      kind === 'product'
        ? products.find(
            (product) =>
              product.id ===
              (selectedProductId ??
                suggestedStockProduct?.product.id),
          )
        : null;
    const suggestedCatalogProduct = productSuggestions.find(
      (
        candidate,
      ): candidate is Extract<
        ProductEntrySuggestion,
        { type: 'catalog' }
      > =>
        candidate.type === 'catalog' &&
        candidate.catalogProduct.name === normalizedName,
    );
    const selectedCatalogProduct =
      kind === 'product'
        ? catalogProducts.find(
            (catalogProduct) =>
              catalogProduct.id ===
              (selectedCatalogProductId ??
                suggestedCatalogProduct?.catalogProduct.id),
          )
        : null;
    const selectedProductSerial = normalizeSerialNumber(
      selectedProduct?.serialNumber,
    );
    if (
      kind === 'product' &&
      selectedProductSerial &&
      normalizedQuantity > 1
    ) {
      onError(
        t('orders.messages.errors.oneSerialPerLineAddSeparately'),
      );
      return;
    }

    onAddItem({
      kind,
      productId: kind === 'product' ? selectedProduct?.id : undefined,
      catalogProductId:
        kind === 'product' ? selectedCatalogProduct?.id : undefined,
      serviceId: kind === 'service' ? nextServiceId : undefined,
      name: normalizedName,
      price: normalizedPrice,
      quantity: normalizedQuantity,
      warrantyPeriod: Number(warrantyPeriod),
      serialNumbers: undefined,
    });
    setName('');
    setPrice('');
    setPriceTier(null);
    setQuantity('1');
    setWarrantyPeriod(kind === 'service' ? '1' : '0');
    setSelectedServiceId(undefined);
    setSelectedProductId(undefined);
    setSelectedCatalogProductId(undefined);
    setServiceSuggestions([]);
    setProductSuggestions([]);
  };
  const handleLineItemPriceChange = (
    item: OrderLineItem,
    value: string,
  ) => {
    setPriceDrafts((current) => ({
      ...current,
      [item.id]: value,
    }));

    if (value === '') return;

    const parsedPrice = parseDecimal(value);
    if (!Number.isFinite(parsedPrice)) return;

    onUpdateItem(item.id, undefined, {
      price: Math.round(parsedPrice * 100) / 100,
    });
  };

  const resolveSalePriceTier = useCallback(
    (
      product: Product | null,
      value: string,
      tier: ProductSalePriceTier | null,
    ): ProductSalePriceTier | null => {
      if (!product || !hasWholesaleSalePrice(product)) return null;
      if (tier && matchesProductSalePriceTier(product, value, tier))
        return tier;
      if (matchesProductSalePriceTier(product, value, 'wholesale')) {
        return 'wholesale';
      }
      if (matchesProductSalePriceTier(product, value, 'retail')) {
        return 'retail';
      }
      return null;
    },
    [],
  );
  const activePriceHeaderTarget = useMemo(() => {
    if (!isProductKind) return null;

    if (activePriceContext === 'entry') {
      if (!selectedStockProduct) return null;

      return {
        product: selectedStockProduct,
        value: price,
        priceTier,
        setPriceTier,
        onPriceChange: setPrice,
      };
    }

    const item = items.find(
      (lineItem) => lineItem.id === activePriceContext,
    );
    if (!item || item.kind !== 'product') return null;

    const product = item.productId
      ? (productsById[item.productId] ?? null)
      : null;

    return {
      product,
      value: priceDrafts[item.id] ?? String(item.price),
      priceTier: priceTierByItemId[item.id] ?? null,
      setPriceTier: (tier: ProductSalePriceTier) => {
        setPriceTierByItemId((current) => ({
          ...current,
          [item.id]: tier,
        }));
      },
      onPriceChange: (nextPrice: string) => {
        handleLineItemPriceChange(item, nextPrice);
      },
    };
  }, [
    activePriceContext,
    handleLineItemPriceChange,
    isProductKind,
    items,
    price,
    priceDrafts,
    priceTier,
    priceTierByItemId,
    productsById,
    selectedStockProduct,
  ]);
  const showPriceHeaderTierToggle = Boolean(
    activePriceHeaderTarget?.product &&
    hasWholesaleSalePrice(activePriceHeaderTarget.product),
  );
  const priceHeaderActiveTier = activePriceHeaderTarget
    ? resolveSalePriceTier(
        activePriceHeaderTarget.product,
        activePriceHeaderTarget.value,
        activePriceHeaderTarget.priceTier,
      )
    : null;
  const handlePriceHeaderTierChange = (
    tier: ProductSalePriceTier,
  ) => {
    if (!activePriceHeaderTarget?.product) return;

    activePriceHeaderTarget.setPriceTier(tier);
    activePriceHeaderTarget.onPriceChange(
      formatProductSalePrice(
        getProductSalePriceByTier(
          activePriceHeaderTarget.product,
          tier,
        ),
      ),
    );
  };
  const showSerialColumn = isProductKind;
  const tableClassName = showSerialColumn
    ? 'order-detail-table order-detail-table-wide order-detail-table-wide-product'
    : 'order-detail-table order-detail-table-wide order-detail-table-wide-service';

  return (
    <div className='order-line-items'>
      <div className={tableClassName}>
        <div className='order-detail-table-header'>
          {t('orders.detail.lineItems.name')}
        </div>
        {showSerialColumn ? (
          <div className='order-detail-table-header'>
            {t('orders.detail.lineItems.serialNumber')}
          </div>
        ) : null}
        <div className='order-detail-table-header order-detail-table-price-header'>
          <span className='order-detail-table-price-header-label'>
            {t('orders.detail.lineItems.price')}
          </span>
          {showPriceHeaderTierToggle && activePriceHeaderTarget ? (
            <ProductSalePriceTierToggle
              activeTier={priceHeaderActiveTier}
              onTierChange={handlePriceHeaderTierChange}
              disabled={isReadOnly}
            />
          ) : null}
        </div>
        <div className='order-detail-table-header'>
          {t('orders.detail.lineItems.qty')}
        </div>
        <div className='order-detail-table-header'>
          {t('orders.detail.lineItems.warranty')}
        </div>
        <div className='order-detail-table-header'>
          {t('orders.detail.lineItems.action')}
        </div>
        {items.length === 0 ? (
          <div className='order-line-items-empty'>
            {isProductKind
              ? t('orders.detail.lineItems.noProductsAdded')
              : t('orders.detail.lineItems.noServicesAdded')}
          </div>
        ) : (
          items.map((item, itemIndex) => {
            const isLastRow = itemIndex === items.length - 1;
            const lastRowClass = isLastRow
              ? 'order-detail-table-last-row'
              : '';
            return (
              <div
                key={`${item.id || 'line-item'}-${itemIndex}`}
                className='order-detail-table-row'
              >
                <div
                  key={`${item.id}-name`}
                  className={lastRowClass || undefined}
                  data-label={t('orders.detail.lineItems.name')}
                >
                  <button
                    type='button'
                    className='order-line-item-name-button'
                    onClick={() => void openLineItemModal(item)}
                    disabled={isReadOnly}
                  >
                    {item.name}
                  </button>
                </div>
                {showSerialColumn ? (
                  <div
                    key={`${item.id}-serial`}
                    className={`order-line-item-serial-cell${lastRowClass ? ` ${lastRowClass}` : ''}`}
                    data-label={t(
                      'orders.detail.lineItems.serialNumber',
                    )}
                  >
                    {item.kind === 'product' &&
                    (item.serialNumbers ?? []).length > 0 ? (
                      <p className='muted-copy order-line-item-serials'>
                        {(item.serialNumbers ?? []).map((serial) => {
                          const normalizedSerial =
                            normalizeSerialNumber(serial);
                          const serialProduct =
                            productsBySerial.get(normalizedSerial);
                          if (!serialProduct) {
                            return <span key={serial}>{serial}</span>;
                          }

                          return (
                            <button
                              key={serial}
                              type='button'
                              className='order-line-item-serial-button'
                              onClick={() =>
                                void openProductModelModal(
                                  serialProduct.name,
                                  serialProduct,
                                )
                              }
                            >
                              {serial}
                            </button>
                          );
                        })}
                      </p>
                    ) : (
                      <span className='muted-copy'>-</span>
                    )}
                  </div>
                ) : null}
                <div
                  key={`${item.id}-price`}
                  className={`order-line-item-price-cell${lastRowClass ? ` ${lastRowClass}` : ''}`}
                  data-label={t('orders.detail.lineItems.price')}
                >
                  <NumberStepper
                    className='line-item-inline-input'
                    min={0}
                    step={0.01}
                    precision={2}
                    value={priceDrafts[item.id] ?? String(item.price)}
                    onChange={(value) =>
                      handleLineItemPriceChange(item, value)
                    }
                    onFocus={() => setActivePriceContext(item.id)}
                    disabled={isReadOnly}
                    ariaLabel={t('orders.detail.lineItems.price')}
                  />
                </div>
                <div
                  key={`${item.id}-qty`}
                  className={lastRowClass || undefined}
                  data-label={t('orders.detail.lineItems.qty')}
                >
                  <NumberStepper
                    className='line-item-inline-input'
                    min={1}
                    value={String(item.quantity)}
                    onChange={(value) => {
                      if (
                        item.kind === 'product' &&
                        (item.serialNumbers ?? []).length > 0
                      ) {
                        onError(
                          t(
                            'orders.messages.errors.oneSerialPerLine',
                          ),
                        );
                        return;
                      }
                      onUpdateItem(item.id, undefined, {
                        quantity: Math.max(1, Number(value) || 1),
                      });
                    }}
                    disabled={
                      isReadOnly ||
                      (item.kind === 'product' &&
                        (item.serialNumbers ?? []).length > 0)
                    }
                  />
                </div>
                <div
                  key={`${item.id}-warranty`}
                  className={lastRowClass || undefined}
                  data-label={t('orders.detail.lineItems.warranty')}
                >
                  <select
                    className='line-item-inline-input'
                    value={item.warrantyPeriod}
                    onChange={(event) =>
                      onUpdateItem(item.id, undefined, {
                        warrantyPeriod: Number(event.target.value),
                      })
                    }
                    disabled={isReadOnly}
                  >
                    {warrantyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  key={`${item.id}-action`}
                  className={`order-line-item-action-cell${lastRowClass ? ` ${lastRowClass}` : ''}`}
                  data-label={t('orders.detail.lineItems.action')}
                >
                  {(() => {
                    const isProduct = item.kind === 'product';
                    const hasBoundSerials =
                      (item.serialNumbers ?? []).length > 0;
                    const canDirectRemove =
                      canDirectRemoveProductItem(item);
                    const canReturnIssued =
                      canReturnIssuedProductItem(item);
                    const canRemoveService =
                      canRemoveServiceItem(item);
                    const canOpenSerials =
                      !isReadOnly || hasBoundSerials;
                    const actionDisabled = isProduct
                      ? !canDirectRemove && !canReturnIssued
                      : !canRemoveService;
                    const actionLabel = isProduct
                      ? canReturnIssued
                        ? t('orders.detail.lineItems.return')
                        : t('orders.detail.lineItems.remove')
                      : t('orders.detail.lineItems.remove');
                    const actionBlockedReason =
                      isProduct && actionDisabled
                        ? getProductActionBlockedReason(item)
                        : !isProduct && actionDisabled
                          ? isReadOnly
                            ? t(
                                'orders.messages.errors.editingBlocked',
                              )
                            : t(
                                'orders.messages.errors.refundBeforeRemoveItem',
                              )
                          : '';
                    return (
                      <>
                        {item.kind === 'product' ? (
                          <button
                            type='button'
                            className='line-item-serials-button'
                            onClick={() => {
                              setSerialsEditingItem(item);
                            }}
                            disabled={!canOpenSerials}
                            title={
                              canOpenSerials
                                ? undefined
                                : t(
                                    'orders.messages.errors.editingBlocked',
                                  )
                            }
                          >
                            <span>
                              {t('orders.detail.lineItems.serials')}
                            </span>
                            <span className='line-item-serials-count'>
                              {`${(item.serialNumbers ?? []).length}/${item.quantity}`}
                            </span>
                          </button>
                        ) : null}
                        <button
                          type='button'
                          className='line-item-remove-button'
                          onClick={() =>
                            isProduct
                              ? canDirectRemove
                                ? onRemoveItem(item.id, undefined)
                                : onReturnItem(item)
                              : onRemoveItem(item.id, undefined)
                          }
                          disabled={actionDisabled}
                          title={actionBlockedReason || undefined}
                        >
                          {actionLabel}
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })
        )}
        <div className='order-detail-table-entry-row'>
          <div
            className='order-line-item-name-entry order-detail-table-entry-cell'
            data-label={t('orders.detail.lineItems.name')}
          >
            <input
              className='line-item-inline-input'
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSelectedServiceId(undefined);
                setSelectedProductId(undefined);
                setSelectedCatalogProductId(undefined);
                setPriceTier(null);
              }}
              placeholder={
                isProductKind
                  ? t('orders.detail.lineItems.addProductPlaceholder')
                  : t('orders.detail.lineItems.addServicePlaceholder')
              }
              disabled={isReadOnly}
            />
          </div>
          {isProductKind ? (
            <div
              className='order-line-item-serial-entry-spacer order-detail-table-entry-cell'
              data-label={t('orders.detail.lineItems.serialNumber')}
              aria-hidden='true'
            />
          ) : null}
          <div
            className='order-line-item-price-cell order-line-item-price-entry-field order-detail-table-entry-cell'
            data-label={t('orders.detail.lineItems.price')}
          >
            {isProductKind ? (
              <ProductSalePriceField
                tierTogglePlacement='none'
                stepperClassName='line-item-inline-input'
                value={price}
                onChange={setPrice}
                product={selectedStockProduct}
                priceTier={priceTier}
                onPriceTierChange={setPriceTier}
                placeholder={t('orders.detail.lineItems.price')}
                disabled={isReadOnly}
                ariaLabel={t('orders.detail.lineItems.price')}
                onFocus={() => setActivePriceContext('entry')}
              />
            ) : (
              <NumberStepper
                className='line-item-inline-input'
                min={0}
                step={0.01}
                precision={2}
                value={price}
                onChange={setPrice}
                placeholder={t('orders.detail.lineItems.price')}
                disabled={isReadOnly}
                ariaLabel={t('orders.detail.lineItems.price')}
              />
            )}
          </div>
          <div
            className='order-line-item-entry-field order-line-item-qty-entry-field order-detail-table-entry-cell'
            data-label={t('orders.detail.lineItems.qty')}
          >
            <NumberStepper
              className='line-item-inline-input order-line-item-qty-entry-stepper'
              min={1}
              value={quantity}
              onChange={setQuantity}
              placeholder={t('orders.detail.lineItems.qty')}
              disabled={isReadOnly}
              ariaLabel={t('orders.detail.lineItems.qty')}
            />
          </div>
          <div
            className='order-line-item-entry-field order-detail-table-entry-cell'
            data-label={t('orders.detail.lineItems.warranty')}
          >
            <select
              className='line-item-inline-input'
              value={warrantyPeriod}
              onChange={(event) =>
                setWarrantyPeriod(event.target.value)
              }
              disabled={isReadOnly}
            >
              {warrantyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div
            className='order-line-item-entry-field order-line-item-entry-action order-detail-table-entry-cell'
            data-label={t('orders.detail.lineItems.action')}
          >
            <button
              type='button'
              className='primary-button line-item-inline-button'
              onClick={() => void submitItem()}
              disabled={isReadOnly}
            >
              {isProductKind
                ? t('orders.detail.lineItems.addProduct')
                : t('orders.detail.lineItems.addService')}
            </button>
          </div>
        </div>
      </div>
      <div className='order-line-items-form'>
        {kind === 'product' &&
        (productSuggestions.length > 0 || isProductLookupLoading) ? (
          <div className='create-suggestions line-item-suggestions'>
            {isProductLookupLoading ? (
              <p>{t('orders.detail.lineItems.searchingProducts')}</p>
            ) : null}
            {productSuggestions.map((suggestion) => {
              const isStockSuggestion = suggestion.type === 'stock';
              const product = isStockSuggestion
                ? suggestion.product
                : null;
              const state = product
                ? getProductSuggestionState(product)
                : {
                    selectable: true,
                    labelKey: 'orders.detail.lineItems.productList',
                  };
              const suggestionKey =
                suggestion.type === 'catalog'
                  ? `catalog-${suggestion.catalogProduct.id}`
                  : `stock-${suggestion.product.id}`;
              const suggestionName =
                suggestion.type === 'catalog'
                  ? suggestion.catalogProduct.name
                  : suggestion.product.name;
              const stockPrice = formatCurrency(
                suggestion.type === 'stock'
                  ? getRetailSalePrice(suggestion.product)
                  : suggestion.price,
              );
              return (
                <button
                  key={suggestionKey}
                  type='button'
                  className='create-suggestion-item'
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => applyProductSuggestion(suggestion)}
                  disabled={isReadOnly || !state.selectable}
                  title={
                    state.selectable ? undefined : t(state.labelKey)
                  }
                >
                  <strong>{suggestionName}</strong>
                  <span>
                    {suggestion.type === 'catalog' ? (
                      <>
                        {stockPrice} /{' '}
                        {t('orders.detail.lineItems.productList')}
                      </>
                    ) : (
                      <>
                        <strong>{suggestion.warehouseName}</strong>
                        {' / '}
                        {stockPrice} / {suggestion.product.article} /{' '}
                        {suggestion.product.serialNumber || '-'} /{' '}
                        {t(state.labelKey)}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {kind === 'service' &&
        (serviceSuggestions.length > 0 || isServiceLookupLoading) ? (
          <div className='create-suggestions line-item-suggestions'>
            {isServiceLookupLoading ? (
              <p>{t('orders.detail.lineItems.searchingServices')}</p>
            ) : null}
            {serviceSuggestions.map((service) => (
              <button
                key={service.id}
                type='button'
                className='create-suggestion-item'
                onClick={() => applyServiceSuggestion(service)}
                disabled={isReadOnly}
              >
                <strong>{service.name}</strong>
                <span>{`${formatCurrency(service.price)}${service.note ? ` / ${service.note}` : ''}`}</span>
              </button>
            ))}
          </div>
        ) : null}
        {canCreateMissingService ? (
          <button
            type='button'
            className='secondary-button line-item-create-service-button'
            onClick={openCreateServiceModal}
            disabled={isReadOnly}
          >
            {t('orders.detail.lineItems.addServiceButton')}
          </button>
        ) : null}
      </div>
      {isCreateServiceOpen ? (
        <OrderDetailCatalogServiceEditorModal
          title={t('orders.detail.lineItems.createService')}
          form={createServiceForm}
          isSaving={isCreateServiceSaving}
          isEditing
          onChange={(field, value) =>
            setCreateServiceForm((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onSubmit={() => void saveCreatedService()}
          onClose={() => setIsCreateServiceOpen(false)}
        />
      ) : null}
      {productModelContext ? (
        <ProductModelModal
          name={productModelContext.name}
          products={products}
          sales={sales}
          warehouses={productModelWarehouses}
          printForms={printForms}
          printProduct={productModelContext.printProduct}
          isSaving={isCatalogSaving}
          onClose={() => setProductModelContext(null)}
          onSave={async (payload) => {
            setIsCatalogSaving(true);
            try {
              return await onUpdateProductModel(payload);
            } finally {
              setIsCatalogSaving(false);
            }
          }}
        />
      ) : null}
      {selectedService ? (
        <OrderDetailCatalogServiceEditorModal
          title={selectedService.name}
          service={selectedService}
          form={serviceForm}
          isSaving={isCatalogSaving}
          isEditing
          onChange={(field, value) =>
            setServiceForm((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onSubmit={() => void saveSelectedService()}
          onClose={() => setSelectedService(null)}
        />
      ) : null}
      {isProductKind && serialsEditingItem ? (
        <SerialBindModal
          lineItem={{
            id: serialsEditingItem.id,
            name: serialsEditingItem.name,
            quantity: serialsEditingItem.quantity,
            price: serialsEditingItem.price,
            warrantyPeriod: serialsEditingItem.warrantyPeriod,
            productId: serialsEditingItem.productId,
            serialNumbers: serialsEditingItem.serialNumbers,
          }}
          warehouses={serialBindWarehouses}
          availableProducts={availableSerialProducts}
          isLoading={isSerialLookupLoading}
          isSuppliersLoading={isSuppliersLoading}
          onClose={() => setSerialsEditingItem(null)}
          onOrder={() => void openSupplierOrderModalForSerialItem()}
          onSave={handleSerialBindSave}
          onError={onError}
        />
      ) : null}
      {isProductKind ? (
        <SupplierOrderModal
          isOpen={isSupplierOrderModalOpen}
          suppliers={suppliers}
          initialProductName={supplierOrderProductName}
          initialQuantity={supplierOrderInitialQuantity}
          onClose={() => setIsSupplierOrderModalOpen(false)}
          onCreateSupplier={handleCreateSupplier}
          onSubmit={handleSubmitSupplierOrder}
          onSuccess={onSuccess}
          onError={onError}
        />
      ) : null}
    </div>
  );
};
