import { useEffect, useMemo, useState } from 'react';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import { createCatalogProduct, getCatalogProducts } from '../../../entities/catalog-product/api/catalogProductApi';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { SupplierOrder, SupplierOrderItem } from '../../../entities/supplier-order/model/types';

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
  editingOrder?: SupplierOrder | null;
  onClose: () => void;
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onSubmit: (payload: SupplierOrderModalSubmitPayload) => Promise<void> | void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

type DraftItem = { productName: string; quantity: number; price: number };

const normalizeProductName = (value: string) =>
  value.trim().toLowerCase();

const isProductMatched = (name: string, suggestions: CatalogProduct[]) => {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return suggestions.some((product) => product.name.trim().toLowerCase() === normalized);
};

export const SupplierOrderModal = ({
  isOpen,
  suppliers,
  initialProductName = '',
  editingOrder,
  onClose,
  onCreateSupplier,
  onSubmit,
  onSuccess,
  onError,
}: SupplierOrderModalProps) => {
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [supplierTouched, setSupplierTouched] = useState(false);

  const [isCreateSupplierModalOpen, setIsCreateSupplierModalOpen] = useState(false);
  const [createSupplierForm, setCreateSupplierForm] = useState({ name: '', phone: '+380', note: '' });
  const [isSupplierCreating, setIsSupplierCreating] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [productSearch, setProductSearch] = useState(initialProductName);
  const [debouncedProductSearch, setDebouncedProductSearch] = useState(initialProductName);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState<CatalogProduct[]>([]);
  const [isProductLookupLoading, setIsProductLookupLoading] = useState(false);
  const [productTouched, setProductTouched] = useState(false);

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
    setShowProductSuggestions(false);
    setProductSuggestions([]);
    setProductTouched(false);

    setBasketItems(
      editingItems.slice(1).map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
      })),
    );

    setForm({
      deliveryDate: (editingOrder?.deliveryDate ?? '').slice(0, 10),
      supplyType: editingOrder?.supplyType ?? 'Локально',
      number: editingOrder?.number ?? '',
      quantity: String(firstItem?.quantity ?? 1),
      price: String(firstItem?.price ?? 0),
      note: editingOrder?.note ?? '',
    });
  }, [editingOrder, initialProductName, isOpen]);

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
    const normalized = debouncedSupplierSearch.trim().toLowerCase();
    if (normalized.length < 2) return [];
    return suppliers
      .filter((supplier) => [supplier.name, supplier.phone].join(' ').toLowerCase().includes(normalized))
      .slice(0, 8);
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

  if (!isOpen) return null;

  const currentQuantity = Math.max(1, Number(form.quantity) || 1);
  const currentPrice = Math.max(0, Number(form.price) || 0);
  const currentProductMatched = isProductMatched(productSearch, productSuggestions);
  const supplierInvalid = supplierTouched && supplierSearch.trim().length > 0 && !selectedSupplier;
  const productInvalid = productTouched && productSearch.trim().length > 0 && !currentProductMatched;
  const currentDraftItem = productSearch.trim()
    ? {
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
    new Set(submitItems.map((item) => normalizeProductName(item.productName)))
      .size !== submitItems.length;

  const totalAmount = submitItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className='modal-backdrop' role='presentation'>
      <section className='catalog-edit-modal supplier-order-modal' role='dialog' aria-modal='true'>
        <header className='catalog-edit-header'>
          <div className='catalog-edit-title'>
            <h2>Замовити у постачальника</h2>
          </div>
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
            <input type='date' value={form.deliveryDate} onChange={(event) => setForm((current) => ({ ...current, deliveryDate: event.target.value }))} />
          </label>

          <label className='field supplier-order-supply-type-field'>
            <span>Тип поставки</span>
            <select value={form.supplyType} onChange={(event) => setForm((current) => ({ ...current, supplyType: event.target.value }))}>
              <option>Локально</option>
              <option>Закордон</option>
            </select>
          </label>

          <label className='field'>
            <span>Номер</span>
            <input value={form.number} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} />
          </label>

          <label className='field field-wide'>
            <span>Примітка</span>
            <textarea rows={2} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
          </label>

          <div className='supplier-order-product-row field-wide'>
            <div className='supplier-order-product-index'>{isEditing ? 1 : basketItems.length + 1}</div>
            <label className='field supplier-order-product-name modal-suggestions-anchor'>
              <span>Товар</span>
              <span className='supplier-search-input-wrap'>
                <input
                  className={productInvalid ? 'supplier-order-invalid-input' : ''}
                  value={productSearch}
                  onFocus={() => setShowProductSuggestions(true)}
                  onBlur={() => {
                    setProductTouched(true);
                    window.setTimeout(() => setShowProductSuggestions(false), 120);
                  }}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder='Введіть щоб знайти та додати'
                />
                <button
                  type='button'
                  className='toolbar-square-button supplier-search-add-button'
                  aria-label='Create catalog product'
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
              <input value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
            </label>
            <label className='field supplier-order-product-compact'>
              <span>К-сть</span>
              <input value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
            </label>
            <label className='field supplier-order-product-compact'>
              <span>Сума</span>
              <input value={String(currentQuantity * currentPrice)} readOnly />
            </label>
              <button
                type='button'
                className='toolbar-square-button supplier-order-product-add'
                aria-label='Add product to order list'
                disabled={!canAddBasketItem}
                onClick={() => {
                  if (!canAddBasketItem) {
                    setProductTouched(true);
                    return;
                  }
                  const nextName = normalizeProductName(productSearch);
                  const duplicateExists = basketItems.some(
                    (item) =>
                      normalizeProductName(item.productName) === nextName,
                  );
                  if (duplicateExists) {
                    onError('Товар з такою назвою вже додано в замовлення.');
                    return;
                  }
                  setBasketItems((current) => [
                    ...current,
                    {
                      productName: productSearch.trim(),
                      quantity: currentQuantity,
                      price: currentPrice,
                    },
                  ]);
                  setProductSearch('');
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
                    <div className='field supplier-order-product-compact'><input value={String(item.quantity)} readOnly /></div>
                    <div className='field supplier-order-product-compact'><input value={String(item.quantity * item.price)} readOnly /></div>
                    <div />
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
          <button
            type='button'
            className='primary-button'
            disabled={isSubmitting || !selectedSupplier || !form.deliveryDate || submitItems.length === 0 || submitItems.some((item) => item.quantity <= 0)}
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

