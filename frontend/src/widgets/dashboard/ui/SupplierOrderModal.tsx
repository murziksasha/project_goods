import { useEffect, useMemo, useState } from 'react';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import { createCatalogProduct, getCatalogProducts } from '../../../entities/catalog-product/api/catalogProductApi';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { SupplierOrder, SupplierOrderItem } from '../../../entities/supplier-order/model/types';
import { getSupplierSuggestions } from '../model/supplier-order-utils';

export type SupplierOrderModalSubmitPayload = {
  supplierId: string;
  deliveryDate: string;
  supplyType: string;
  number: string;
  note: string;
  items: SupplierOrderItem[];
};

type SupplierOrderModalProps = {
  isOpen: boolean;
  suppliers: Supplier[];
  initialProductName?: string;
  initialQuantity?: number;
  editingOrder?: SupplierOrder | null;
  forceReadOnly?: boolean;
  onClose: () => void;
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onSubmit: (payload: SupplierOrderModalSubmitPayload) => Promise<void> | void;
  onTakeOnCharge?: (payload: {
    autoGenerateSerialNumbers: boolean;
    serialNumbers: string[];
    autoGenerateArticles: boolean;
    articleBase: string;
    warehouseId: string;
    locationId: string;
  }) => Promise<void> | void;
  onCancelOrder?: () => Promise<void> | void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  warehouseOptions?: Array<{
    id: string;
    name: string;
    locations: Array<{ id: string; name: string }>;
  }>;
};

type DraftItem = {
  catalogProductId?: string;
  productName: string;
  quantity: number;
  price: number;
};
const EMPTY_WAREHOUSE_OPTIONS: Array<{
  id: string;
  name: string;
  locations: Array<{ id: string; name: string }>;
}> = [];

const normalizeProductName = (value: string) =>
  value.trim().toLowerCase();

export const SupplierOrderModal = ({
  isOpen,
  suppliers,
  initialProductName = '',
  initialQuantity = 1,
  editingOrder,
  forceReadOnly = false,
  onClose,
  onCreateSupplier,
  onSubmit,
  onTakeOnCharge,
  onCancelOrder,
  onSuccess,
  onError,
  warehouseOptions,
}: SupplierOrderModalProps) => {
  const resolvedWarehouseOptions =
    warehouseOptions ?? EMPTY_WAREHOUSE_OPTIONS;
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [supplierTouched, setSupplierTouched] = useState(false);

  const [isCreateSupplierModalOpen, setIsCreateSupplierModalOpen] = useState(false);
  const [createSupplierForm, setCreateSupplierForm] = useState({ name: '', phone: '+380', note: '' });
  const [isSupplierCreating, setIsSupplierCreating] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [isSerialModalOpen, setIsSerialModalOpen] = useState(false);
  const [isAutoSerialEnabled, setIsAutoSerialEnabled] = useState(true);
  const [manualSerialNumbers, setManualSerialNumbers] = useState<string[]>([]);
  const [isAutoArticleEnabled, setIsAutoArticleEnabled] = useState(false);
  const [manualArticleBase, setManualArticleBase] = useState('');
  const [takeOnChargeWarehouseId, setTakeOnChargeWarehouseId] = useState('');
  const [takeOnChargeLocationId, setTakeOnChargeLocationId] = useState('');

  const [productSearch, setProductSearch] = useState(initialProductName);
  const [debouncedProductSearch, setDebouncedProductSearch] = useState(initialProductName);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState<CatalogProduct[]>([]);
  const [isProductLookupLoading, setIsProductLookupLoading] = useState(false);
  const [productTouched, setProductTouched] = useState(false);
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState<string>('');

  const [isCreateCatalogProductModalOpen, setIsCreateCatalogProductModalOpen] = useState(false);
  const [isCreateCatalogProductSaving, setIsCreateCatalogProductSaving] = useState(false);
  const [createCatalogProductForm, setCreateCatalogProductForm] = useState({ name: '', note: '' });

  const [basketItems, setBasketItems] = useState<DraftItem[]>([]);
  const [form, setForm] = useState({
    deliveryDate: '',
    supplyType: 'Локально',
    number: '',
    quantity: '1',
    price: '0',
    note: '',
  });

  const isEditing = Boolean(editingOrder);
  const isTakenOnChargeLocked = Boolean(
    editingOrder &&
      (editingOrder.receiptStatus === 'received' ||
        editingOrder.status === 'cancelled' ||
        editingOrder.paymentStatus === 'cancelled'),
  );
  const isReadOnly = forceReadOnly || isTakenOnChargeLocked;

  useEffect(() => {
    if (!isOpen) return;

    const editingItems = editingOrder?.items ?? [];
    const firstItem = editingItems[0];

    setSupplierSearch(editingOrder?.supplierName ?? '');
    setDebouncedSupplierSearch(editingOrder?.supplierName ?? '');
    setShowSupplierSuggestions(false);
    setSupplierTouched(false);

    setIsCreateSupplierModalOpen(false);
    setCreateSupplierForm({ name: '', phone: '+380', note: '' });

    setProductSearch(firstItem?.productName ?? initialProductName);
    setDebouncedProductSearch(firstItem?.productName ?? initialProductName);
    setSelectedCatalogProductId(firstItem?.catalogProductId ?? '');
    setShowProductSuggestions(false);
    setProductSuggestions([]);
    setProductTouched(false);

    setBasketItems(
      editingItems.slice(1).map((item) => ({
        catalogProductId: item.catalogProductId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
      })),
    );

    setForm({
      deliveryDate: (editingOrder?.deliveryDate ?? '').slice(0, 10),
      supplyType: editingOrder?.supplyType ?? 'Локально',
      number: editingOrder?.number ?? '',
      quantity: String(
        firstItem?.quantity ?? Math.max(1, Math.floor(initialQuantity)),
      ),
      price: String(firstItem?.price ?? 0),
      note: editingOrder?.note ?? '',
    });
    setIsSerialModalOpen(false);
    setIsAutoSerialEnabled(true);
    setManualSerialNumbers([]);
    setIsAutoArticleEnabled(false);
    setManualArticleBase('');
    const defaultWarehouse = resolvedWarehouseOptions[0];
    setTakeOnChargeWarehouseId(defaultWarehouse?.id ?? '');
    setTakeOnChargeLocationId(defaultWarehouse?.locations[0]?.id ?? '');
  }, [
    editingOrder,
    initialProductName,
    initialQuantity,
    isOpen,
    resolvedWarehouseOptions,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSupplierSearch(supplierSearch), 300);
    return () => window.clearTimeout(timeoutId);
  }, [supplierSearch]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedProductSearch(productSearch), 250);
    return () => window.clearTimeout(timeoutId);
  }, [productSearch]);

  useEffect(() => {
    const query = debouncedProductSearch.trim();
    if (query.length < 2) {
      setProductSuggestions([]);
      setIsProductLookupLoading(false);
      return;
    }

    let isCancelled = false;
    setIsProductLookupLoading(true);
    void getCatalogProducts(query)
      .then((products) => {
        if (isCancelled) return;
        setProductSuggestions(products.slice(0, 8));
      })
      .catch(() => {
        if (isCancelled) return;
        setProductSuggestions([]);
      })
      .finally(() => {
        if (!isCancelled) setIsProductLookupLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [debouncedProductSearch]);

  const supplierOptions = useMemo(() => {
    return getSupplierSuggestions(
      suppliers,
      debouncedSupplierSearch,
    );
  }, [debouncedSupplierSearch, suppliers]);

  const selectedSupplier = useMemo(() => {
    if (!supplierSearch.trim()) return null;
    const normalized = supplierSearch.trim().toLowerCase();
    return (
      suppliers.find((supplier) =>
        [supplier.name, supplier.phone].some((value) => value.trim().toLowerCase() === normalized),
      ) ?? null
    );
  }, [supplierSearch, suppliers]);

  const currentQuantity = Math.max(1, Number(form.quantity) || 1);
  const currentPrice = Math.max(0, Number(form.price) || 0);
  const currentProductMatched = Boolean(selectedCatalogProductId);
  const supplierInvalid = supplierTouched && supplierSearch.trim().length > 0 && !selectedSupplier;
  const productInvalid = productTouched && productSearch.trim().length > 0 && !currentProductMatched;
  const currentDraftItem = productSearch.trim()
    ? {
        catalogProductId: selectedCatalogProductId || undefined,
        productName: productSearch.trim(),
        quantity: currentQuantity,
        price: currentPrice,
      }
    : null;

  const canAddBasketItem = Boolean(productSearch.trim()) && currentQuantity > 0 && currentProductMatched;
  const submitItems: DraftItem[] = isEditing
    ? [...(currentDraftItem ? [currentDraftItem] : []), ...basketItems]
    : basketItems;
  const basketSummaryItems: DraftItem[] = isEditing
    ? basketItems
    : submitItems;
  const hasDuplicateSubmitItems =
    new Set(
      submitItems.map((item) =>
        item.catalogProductId || normalizeProductName(item.productName),
      ),
    )
      .size !== submitItems.length;

  const totalAmount = submitItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalUnits = submitItems.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(item.quantity)),
    0,
  );
  const serialUnitLabels = submitItems.flatMap((item) =>
    Array.from(
      { length: Math.max(0, Math.floor(item.quantity)) },
      () => item.productName,
    ),
  );
  const canSubmitTakeOnCharge = isAutoSerialEnabled
    ? true
    : manualSerialNumbers.length === totalUnits &&
      manualSerialNumbers.every((serial) => serial.trim().length > 0);
  const selectedTakeOnChargeWarehouse = resolvedWarehouseOptions.find(
    (warehouse) => warehouse.id === takeOnChargeWarehouseId,
  );
  const selectedTakeOnChargeLocations =
    selectedTakeOnChargeWarehouse?.locations ?? [];
  const updateBasketItemQuantity = (
    itemIndex: number,
    quantityValue: string,
  ) => {
    const normalizedQuantity = Math.max(
      1,
      Math.floor(Number(quantityValue) || 1),
    );
    setBasketItems((current) =>
      current.map((item, index) =>
        index === itemIndex
          ? { ...item, quantity: normalizedQuantity }
          : item,
      ),
    );
  };
  const removeBasketItem = (itemIndex: number) => {
    setBasketItems((current) =>
      current.filter((_, index) => index !== itemIndex),
    );
  };

  useEffect(() => {
    if (selectedTakeOnChargeLocations.length === 0) {
      setTakeOnChargeLocationId('');
      return;
    }
    const isLocationExists = selectedTakeOnChargeLocations.some(
      (location) => location.id === takeOnChargeLocationId,
    );
    if (!isLocationExists) {
      setTakeOnChargeLocationId(selectedTakeOnChargeLocations[0]?.id ?? '');
    }
  }, [selectedTakeOnChargeLocations, takeOnChargeLocationId]);

  if (!isOpen) return null;

  return (
    <div className='modal-backdrop' role='presentation'>
      <section className='catalog-edit-modal supplier-order-modal' role='dialog' aria-modal='true'>
        <header className='catalog-edit-header'>
          <div className='catalog-edit-title'>
            <h2>Замовити у постачальника</h2>
          </div>
          {isEditing && onCancelOrder ? (
            <button
              type='button'
              className='danger-button'
              disabled={isActionSubmitting || isReadOnly}
              onClick={async () => {
                setIsActionSubmitting(true);
                try {
                  await onCancelOrder();
                  onClose();
                } finally {
                  setIsActionSubmitting(false);
                }
              }}
              style={{ marginLeft: 'auto', marginRight: 12 }}
            >
              Удалить
            </button>
          ) : null}
          <button type='button' className='create-order-close' onClick={onClose} aria-label='Close'>
            &times;
          </button>
        </header>
        <div className='catalog-edit-body supplier-order-modal-body'>
          <div className='create-device-search supplier-order-supplier-field modal-suggestions-anchor'>
            <label className='field supplier-search-field'>
              <span>Постачальник</span>
              <span className='supplier-search-input-wrap'>
                <input
                  className={supplierInvalid ? 'supplier-order-invalid-input' : ''}
                  value={supplierSearch}
                  disabled={isReadOnly}
                  onFocus={() => setShowSupplierSuggestions(true)}
                  onBlur={() => {
                    setSupplierTouched(true);
                    window.setTimeout(() => setShowSupplierSuggestions(false), 120);
                  }}
                  onChange={(event) => {
                    setSupplierSearch(event.target.value);
                    setShowSupplierSuggestions(true);
                  }}
                  placeholder='Пошук'
                />
                <button
                  type='button'
                  className='toolbar-square-button supplier-search-add-button'
                  aria-label='Create supplier'
                  disabled={isReadOnly}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setCreateSupplierForm({ name: supplierSearch.trim(), phone: '+380', note: '' });
                    setIsCreateSupplierModalOpen(true);
                  }}
                >
                  +
                </button>
              </span>
            </label>
            {showSupplierSuggestions && supplierOptions.length > 0 ? (
              <div className='create-suggestions field-wide'>
                {supplierOptions.map((supplier) => (
                  <button
                    key={supplier.id}
                    type='button'
                    className='create-suggestion-item'
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSupplierSearch(supplier.name);
                      setSupplierTouched(true);
                      setShowSupplierSuggestions(false);
                    }}
                  >
                    <strong>{supplier.name}</strong>
                    <span>{supplier.phone}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className='field'>
            <span>Дата поставки</span>
            <input type='date' value={form.deliveryDate} disabled={isReadOnly} onChange={(event) => setForm((current) => ({ ...current, deliveryDate: event.target.value }))} />
          </label>

          <label className='field supplier-order-supply-type-field'>
            <span>Тип поставки</span>
            <select value={form.supplyType} disabled={isReadOnly} onChange={(event) => setForm((current) => ({ ...current, supplyType: event.target.value }))}>
              <option>Локально</option>
              <option>Закордон</option>
            </select>
          </label>

          <label className='field'>
            <span>Номер</span>
            <input value={form.number} disabled={isReadOnly} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} />
          </label>

          <label className='field field-wide'>
            <span>Примітка</span>
            <textarea rows={2} value={form.note} disabled={isReadOnly} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
          </label>

          <div className='supplier-order-product-row field-wide'>
            <div className='supplier-order-product-index'>{isEditing ? 1 : basketItems.length + 1}</div>
            <label className='field supplier-order-product-name modal-suggestions-anchor'>
              <span>Товар</span>
              <span className='supplier-search-input-wrap'>
                <input
                  className={productInvalid ? 'supplier-order-invalid-input' : ''}
                  value={productSearch}
                  disabled={isReadOnly}
                  onFocus={() => setShowProductSuggestions(true)}
                  onBlur={() => {
                    setProductTouched(true);
                    window.setTimeout(() => setShowProductSuggestions(false), 120);
                  }}
                  onChange={(event) => {
                    setProductSearch(event.target.value);
                    setSelectedCatalogProductId('');
                  }}
                  placeholder='Введіть щоб знайти та додати'
                />
                <button
                  type='button'
                  className='toolbar-square-button supplier-search-add-button'
                  aria-label='Create catalog product'
                  disabled={isReadOnly}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setCreateCatalogProductForm({ name: productSearch.trim(), note: '' });
                    setIsCreateCatalogProductModalOpen(true);
                  }}
                >
                  +
                </button>
              </span>
              {showProductSuggestions && (productSuggestions.length > 0 || isProductLookupLoading) ? (
                <div className='create-suggestions field-wide'>
                  {isProductLookupLoading ? <p>Пошук товарів...</p> : null}
                  {productSuggestions.map((product) => (
                    <button
                      key={product.id}
                      type='button'
                      className='create-suggestion-item'
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setProductSearch(product.name);
                        setSelectedCatalogProductId(product.id);
                        setShowProductSuggestions(false);
                        setProductTouched(true);
                      }}
                    >
                      <strong>{product.name}</strong>
                      <span>{product.note || 'Product from catalog'}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
            <label className='field supplier-order-product-compact'>
              <span>Ціна (UAH)</span>
              <input value={form.price} disabled={isReadOnly} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
            </label>
            <label className='field supplier-order-product-compact'>
              <span>К-сть</span>
              <input value={form.quantity} disabled={isReadOnly} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
            </label>
            <label className='field supplier-order-product-compact'>
              <span>Сума</span>
              <input value={String(currentQuantity * currentPrice)} readOnly />
            </label>
              <button
                type='button'
                className='toolbar-square-button supplier-order-product-add'
                aria-label='Add product to order list'
                disabled={!canAddBasketItem || isReadOnly}
                onClick={() => {
                  if (!canAddBasketItem) {
                    setProductTouched(true);
                    return;
                  }
                  const nextName = normalizeProductName(productSearch);
                  const duplicateExists = basketItems.some(
                    (item) =>
                      (selectedCatalogProductId &&
                        item.catalogProductId === selectedCatalogProductId) ||
                      normalizeProductName(item.productName) === nextName,
                  );
                  if (duplicateExists) {
                    onError('Товар з такою назвою вже додано в замовлення.');
                    return;
                  }
                  setBasketItems((current) => [
                    ...current,
                    {
                      catalogProductId:
                        selectedCatalogProductId || undefined,
                      productName: productSearch.trim(),
                      quantity: currentQuantity,
                      price: currentPrice,
                    },
                  ]);
                  setProductSearch('');
                  setSelectedCatalogProductId('');
                  setShowProductSuggestions(false);
                  setProductTouched(false);
                  setForm((current) => ({ ...current, quantity: '1', price: '0' }));
                }}
              >
                +
              </button>
          </div>

          {basketSummaryItems.length > 0 ? (
            <div className='supplier-order-basket-summary'>
              <div className='supplier-order-basket-table'>
                {basketSummaryItems.map((item, index) => (
                  <div key={`${item.productName}-${index}`} className='supplier-order-product-row supplier-order-basket-row'>
                    <div className='supplier-order-product-index'>{isEditing ? index + 2 : index + 1}</div>
                    <div className='field supplier-order-product-name'><input value={item.productName} readOnly /></div>
                    <div className='field supplier-order-product-compact'><input value={String(item.price)} readOnly /></div>
                    <div className='field supplier-order-product-compact'>
                      <input
                        value={String(item.quantity)}
                        disabled={isReadOnly}
                        onChange={(event) =>
                          updateBasketItemQuantity(index, event.target.value)
                        }
                      />
                    </div>
                    <div className='field supplier-order-product-compact'><input value={String(item.quantity * item.price)} readOnly /></div>
                    <button
                      type='button'
                      className='toolbar-square-button supplier-order-product-add'
                      aria-label='Remove product from order list'
                      disabled={isReadOnly}
                      onClick={() => removeBasketItem(index)}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className='supplier-order-total-row field-wide'>
            <span>Разом</span>
            <input value={String(totalAmount)} readOnly />
          </div>
        </div>

        <footer className='catalog-edit-footer'>
          {isEditing && onTakeOnCharge && !isReadOnly ? (
            <button
              type='button'
              className='primary-button'
              disabled={isSubmitting || isActionSubmitting}
              onClick={() => {
                setIsSerialModalOpen(true);
                setIsAutoSerialEnabled(true);
                setManualSerialNumbers(Array.from({ length: totalUnits }, () => ''));
                setIsAutoArticleEnabled(false);
                setManualArticleBase('');
              }}
              style={{ background: '#16a34a' }}
            >
              Оприбуткувати
            </button>
          ) : null}
          {isReadOnly ? (
            <button type='button' className='secondary-button' onClick={onClose}>
              Close
            </button>
          ) : (
            <button
              type='button'
              className='primary-button'
              disabled={isSubmitting || isActionSubmitting || !selectedSupplier || !form.deliveryDate || submitItems.length === 0 || submitItems.some((item) => item.quantity <= 0)}
              onClick={async () => {
                if (!selectedSupplier) {
                  setSupplierTouched(true);
                  return;
                }
                if (hasDuplicateSubmitItems) {
                  onError('В замовленні не може бути двох однакових товарів.');
                  return;
                }
                setIsSubmitting(true);
                try {
                  await onSubmit({
                    supplierId: selectedSupplier.id,
                    deliveryDate: form.deliveryDate,
                    supplyType: form.supplyType,
                    number: form.number,
                    note: form.note,
                    items: submitItems.map((item, index) => ({
                      lineId: `line-${index + 1}`,
                      itemIndex: index,
                      catalogProductId: item.catalogProductId,
                      productName: item.productName,
                      quantity: item.quantity,
                      price: item.price,
                    })),
                  });
                  onClose();
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isSubmitting ? 'Збереження...' : isEditing ? 'Зберегти' : 'Створити'}
            </button>
          )}
        </footer>
      </section>

      {isCreateCatalogProductModalOpen ? (
        <div className='supplier-order-inline-backdrop' role='presentation'>
          <section className='catalog-edit-modal clients-modal supplier-order-create-supplier-modal' role='dialog' aria-modal='true'>
            <header className='catalog-edit-header'><div className='catalog-edit-title'><h2>Product</h2></div><button type='button' className='create-order-close' onClick={() => setIsCreateCatalogProductModalOpen(false)} aria-label='Close'>&times;</button></header>
            <div className='catalog-edit-body clients-modal-body'>
              <label className='field field-wide'><span>Product name</span><input value={createCatalogProductForm.name} onChange={(event) => setCreateCatalogProductForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className='field field-wide'><span>Note</span><textarea rows={3} value={createCatalogProductForm.note} onChange={(event) => setCreateCatalogProductForm((current) => ({ ...current, note: event.target.value }))} /></label>
            </div>
            <footer className='catalog-edit-footer'>
              <button type='button' className='secondary-button' onClick={() => setIsCreateCatalogProductModalOpen(false)} disabled={isCreateCatalogProductSaving}>Cancel</button>
              <button
                type='button'
                className='primary-button'
                disabled={isCreateCatalogProductSaving || createCatalogProductForm.name.trim().length < 2}
                onClick={async () => {
                  setIsCreateCatalogProductSaving(true);
                  try {
                    const created = await createCatalogProduct({ name: createCatalogProductForm.name.trim(), note: createCatalogProductForm.note.trim(), isActive: true });
                    setProductSearch(created.name);
                    setSelectedCatalogProductId(created.id);
                    setProductTouched(true);
                    setShowProductSuggestions(false);
                    setCreateCatalogProductForm({ name: '', note: '' });
                    setIsCreateCatalogProductModalOpen(false);
                    onSuccess('Product created.');
                  } catch (error) {
                    onError(error instanceof Error ? error.message : 'Failed to create product.');
                  } finally {
                    setIsCreateCatalogProductSaving(false);
                  }
                }}
              >
                {isCreateCatalogProductSaving ? 'Saving...' : 'Save'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {isSerialModalOpen ? (
        <div className='supplier-order-inline-backdrop' role='presentation'>
          <section
            className='catalog-edit-modal clients-modal supplier-order-create-supplier-modal'
            role='dialog'
            aria-modal='true'
          >
            <header className='catalog-edit-header'>
              <div className='catalog-edit-title'>
                <h2>Оприходование</h2>
              </div>
              <button
                type='button'
                className='create-order-close'
                onClick={() => setIsSerialModalOpen(false)}
                aria-label='Close'
              >
                &times;
              </button>
            </header>
            <div className='catalog-edit-body clients-modal-body'>
              <label className='supplier-serial-auto'>
                <input
                  type='checkbox'
                  checked={isAutoSerialEnabled}
                  onChange={(event) =>
                    setIsAutoSerialEnabled(event.target.checked)
                  }
                />
                <span>Автогенерация серийных номеров</span>
              </label>
              {!isAutoSerialEnabled ? (
                <div className='warehouse-receipt-modal-grid'>
                  {manualSerialNumbers.map((serialNumber, index) => (
                    <label key={`serial-${index}`} className='field'>
                      <span className='supplier-serial-label'>
                        <span className='supplier-serial-index'>{`#${index + 1}`}</span>
                        <span
                          className='supplier-serial-product'
                          title={serialUnitLabels[index] ?? ''}
                        >
                          {serialUnitLabels[index] ?? ''}
                        </span>
                      </span>
                      <input
                        value={serialNumber}
                        onChange={(event) =>
                          setManualSerialNumbers((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? event.target.value
                                : item,
                            ),
                          )
                        }
                        placeholder='serial number'
                      />
                    </label>
                  ))}
                </div>
              ) : null}
              <label className='supplier-serial-auto'>
                <input
                  type='checkbox'
                  checked={isAutoArticleEnabled}
                  onChange={(event) =>
                    setIsAutoArticleEnabled(event.target.checked)
                  }
                />
                <span>Автогенерация артикулов</span>
              </label>
              {!isAutoArticleEnabled ? (
                <label className='field field-wide'>
                  <span>Артикул для всего количества</span>
                  <input
                    value={manualArticleBase}
                    onChange={(event) =>
                      setManualArticleBase(event.target.value.toUpperCase())
                    }
                    placeholder='Например: SSD-KINGSTON'
                  />
                </label>
              ) : null}
              <label className='field field-wide'>
                <span>Warehouse</span>
                <select
                  value={takeOnChargeWarehouseId}
                  onChange={(event) =>
                    setTakeOnChargeWarehouseId(event.target.value)
                  }
                >
                    {resolvedWarehouseOptions.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className='field field-wide'>
                <span>Location</span>
                <select
                  value={takeOnChargeLocationId}
                  onChange={(event) =>
                    setTakeOnChargeLocationId(event.target.value)
                  }
                  disabled={selectedTakeOnChargeLocations.length === 0}
                >
                  {selectedTakeOnChargeLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='secondary-button'
                onClick={() => setIsSerialModalOpen(false)}
                disabled={isActionSubmitting}
              >
                Cancel
              </button>
              <button
                type='button'
                className='primary-button'
                disabled={
                  isActionSubmitting ||
                  totalUnits <= 0 ||
                  !canSubmitTakeOnCharge ||
                  !takeOnChargeWarehouseId ||
                  !takeOnChargeLocationId
                }
                onClick={async () => {
                  if (!onTakeOnCharge) return;
                  const normalizedArticleBase = manualArticleBase
                    .trim()
                    .toUpperCase();
                  setIsActionSubmitting(true);
                  try {
                    await onTakeOnCharge({
                      autoGenerateSerialNumbers: isAutoSerialEnabled,
                      serialNumbers: isAutoSerialEnabled
                        ? []
                        : manualSerialNumbers.map((item) =>
                            item.trim(),
                          ),
                      autoGenerateArticles: isAutoArticleEnabled,
                      articleBase: isAutoArticleEnabled
                        ? ''
                        : normalizedArticleBase,
                      warehouseId: takeOnChargeWarehouseId,
                      locationId: takeOnChargeLocationId,
                    });
                    setIsSerialModalOpen(false);
                    onClose();
                  } catch (error) {
                    onError(
                      error instanceof Error
                        ? error.message
                        : 'Failed to take order on charge.',
                    );
                  } finally {
                    setIsActionSubmitting(false);
                  }
                }}
              >
                {isActionSubmitting ? 'Saving...' : 'Оприбуткувати'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {isCreateSupplierModalOpen ? (
        <div className='supplier-order-inline-backdrop' role='presentation'>
          <section className='catalog-edit-modal clients-modal supplier-order-create-supplier-modal' role='dialog' aria-modal='true'>
            <header className='catalog-edit-header'><div className='catalog-edit-title'><h2>Create supplier</h2></div><button type='button' className='create-order-close' onClick={() => setIsCreateSupplierModalOpen(false)} aria-label='Close'>&times;</button></header>
            <div className='catalog-edit-body clients-modal-body'>
              <label className='field field-wide'><span>Name</span><input value={createSupplierForm.name} onChange={(event) => setCreateSupplierForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className='field field-wide'><span>Phone</span><input value={createSupplierForm.phone} onChange={(event) => setCreateSupplierForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label className='field field-wide'><span>Note</span><textarea rows={4} value={createSupplierForm.note} onChange={(event) => setCreateSupplierForm((current) => ({ ...current, note: event.target.value }))} /></label>
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={isSupplierCreating || !createSupplierForm.name.trim() || !createSupplierForm.phone.trim()}
                onClick={async () => {
                  setIsSupplierCreating(true);
                  const created = await onCreateSupplier({ name: createSupplierForm.name.trim(), phone: createSupplierForm.phone.trim(), note: createSupplierForm.note.trim(), supplierOrder: '', isActive: true });
                  if (created) {
                    onSuccess('Supplier created.');
                    setSupplierSearch(createSupplierForm.name.trim());
                    setSupplierTouched(true);
                    setIsCreateSupplierModalOpen(false);
                  } else {
                    onError('Failed to create supplier.');
                  }
                  setIsSupplierCreating(false);
                }}
              >
                {isSupplierCreating ? 'Saving...' : 'Create'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
};

