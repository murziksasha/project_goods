import { useEffect, useMemo, useState } from 'react';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import { createCatalogProduct, getCatalogProducts } from '../../../entities/catalog-product/api/catalogProductApi';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';

export type SupplierOrderModalSubmitPayload = {
  orderBaseId: string;
  itemIndex: number;
  supplierId: string;
  deliveryDate: string;
  supplyType: string;
  number: string;
  productName: string;
  quantity: number;
  price: number;
  note: string;
};

type SupplierOrderModalProps = {
  isOpen: boolean;
  suppliers: Supplier[];
  initialProductName?: string;
  onClose: () => void;
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onSubmit: (payload: SupplierOrderModalSubmitPayload) => Promise<void> | void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export const SupplierOrderModal = ({
  isOpen,
  suppliers,
  initialProductName = '',
  onClose,
  onCreateSupplier,
  onSubmit,
  onSuccess,
  onError,
}: SupplierOrderModalProps) => {
  const minSupplierSearchLength = 3;
  const supplierSearchDebounceMs = 300;
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [isCreateSupplierModalOpen, setIsCreateSupplierModalOpen] = useState(false);
  const [createSupplierForm, setCreateSupplierForm] = useState({
    name: '',
    phone: '+380',
    note: '',
  });
  const [isSupplierCreating, setIsSupplierCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [productSearch, setProductSearch] = useState(initialProductName);
  const [debouncedProductSearch, setDebouncedProductSearch] = useState(initialProductName);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState<CatalogProduct[]>([]);
  const [isProductLookupLoading, setIsProductLookupLoading] = useState(false);
  const [isCreateCatalogProductModalOpen, setIsCreateCatalogProductModalOpen] = useState(false);
  const [isCreateCatalogProductSaving, setIsCreateCatalogProductSaving] = useState(false);
  const [createCatalogProductForm, setCreateCatalogProductForm] = useState({
    name: '',
    note: '',
  });
  const [basketItems, setBasketItems] = useState<
    Array<{
      productName: string;
      quantity: number;
      price: number;
    }>
  >([]);
  const [form, setForm] = useState({
    deliveryDate: '',
    supplyType: 'Локально',
    number: '',
    productName: initialProductName,
    quantity: '1',
    price: '0',
    note: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    setSupplierSearch('');
    setDebouncedSupplierSearch('');
    setShowSupplierSuggestions(false);
    setIsCreateSupplierModalOpen(false);
    setCreateSupplierForm({ name: '', phone: '+380', note: '' });
    setProductSearch(initialProductName);
    setDebouncedProductSearch(initialProductName);
    setShowProductSuggestions(false);
    setProductSuggestions([]);
    setBasketItems([]);
    setForm({
      deliveryDate: '',
      supplyType: 'Локально',
      number: '',
      productName: initialProductName,
      quantity: '1',
      price: '0',
      note: '',
    });
  }, [initialProductName, isOpen]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSupplierSearch(supplierSearch);
    }, supplierSearchDebounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [supplierSearch, supplierSearchDebounceMs]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedProductSearch(productSearch);
    }, 250);

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
    if (normalized.length < minSupplierSearchLength) return [];

    const options = suppliers.filter((supplier) =>
      [supplier.name, supplier.phone].join(' ').toLowerCase().includes(normalized),
    );
    return options.slice(0, 8);
  }, [debouncedSupplierSearch, suppliers]);

  const selectedSupplier = useMemo(() => {
    if (!supplierSearch.trim()) return null;

    const normalized = supplierSearch.trim().toLowerCase();
    const exactMatch = suppliers.find((supplier) =>
      [supplier.name, supplier.phone].some(
        (value) => value.trim().toLowerCase() === normalized,
      ),
    );
    if (exactMatch) return exactMatch;

    return supplierOptions.length === 1 ? supplierOptions[0] : null;
  }, [supplierOptions, supplierSearch, suppliers]);

  if (!isOpen) return null;

  const currentQuantity = Math.max(1, Number(form.quantity) || 1);
  const currentPrice = Math.max(0, Number(form.price) || 0);
  const canAddBasketItem = !!productSearch.trim() && currentQuantity > 0;
  const hasCurrentDraft = !!productSearch.trim();
  const totalItemsToSubmit = basketItems.length + (hasCurrentDraft ? 1 : 0);
  const totalAmount =
    basketItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    ) + (hasCurrentDraft ? currentPrice * currentQuantity : 0);
  const hasExactProductMatch = productSuggestions.some(
    (product) => product.name.trim().toLowerCase() === productSearch.trim().toLowerCase(),
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="catalog-edit-modal supplier-order-modal" role="dialog" aria-modal="true">
        <header className="catalog-edit-header">
          <div className="catalog-edit-title">
            <h2>Замовити у постачальника</h2>
          </div>
          <button type="button" className="create-order-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>
        <div className="catalog-edit-body supplier-order-modal-body">
          <div className="create-device-search supplier-order-supplier-field">
            <label className="field supplier-search-field">
              <span>Постачальник</span>
              <span className="supplier-search-input-wrap">
                <input
                  value={supplierSearch}
                  onFocus={() => setShowSupplierSuggestions(true)}
                  onBlur={() =>
                    window.setTimeout(() => setShowSupplierSuggestions(false), 120)
                  }
                  onChange={(event) => {
                    setSupplierSearch(event.target.value);
                    setShowSupplierSuggestions(true);
                  }}
                  placeholder="Пошук"
                />
                <button
                  type="button"
                  className="toolbar-square-button supplier-search-add-button"
                  aria-label="Create supplier"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setCreateSupplierForm({
                      name: supplierSearch.trim(),
                      phone: '+380',
                      note: '',
                    });
                    setIsCreateSupplierModalOpen(true);
                  }}
                >
                  +
                </button>
              </span>
            </label>
          </div>
          {showSupplierSuggestions && supplierOptions.length > 0 ? (
            <div className="create-suggestions field-wide">
              {supplierOptions.map((supplier) => (
                <button
                  key={supplier.id}
                  type="button"
                  className="create-suggestion-item"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSupplierSearch(supplier.name);
                    setShowSupplierSuggestions(false);
                  }}
                >
                  <strong>{supplier.name}</strong>
                  <span>{supplier.phone}</span>
                </button>
              ))}
            </div>
          ) : null}
          <label className="field">
            <span>Дата поставки</span>
            <input
              type="date"
              value={form.deliveryDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, deliveryDate: event.target.value }))
              }
            />
          </label>
          <label className="field supplier-order-supply-type-field">
            <span>Тип поставки</span>
            <select
              value={form.supplyType}
              onChange={(event) =>
                setForm((current) => ({ ...current, supplyType: event.target.value }))
              }
            >
              <option>Локально</option>
              <option>Закордон</option>
            </select>
          </label>
          <label className="field">
            <span>Номер</span>
            <input
              value={form.number}
              onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
            />
          </label>
          <label className="field field-wide">
            <span>Примітка</span>
            <textarea
              rows={2}
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            />
          </label>
          <div className="supplier-order-product-row field-wide">
            <div className="supplier-order-product-index">
              {basketItems.length + 1}
            </div>
            <label className="field supplier-order-product-name">
              <span>Товар</span>
              <span className="supplier-search-input-wrap">
                <input
                  value={productSearch}
                  onFocus={() => setShowProductSuggestions(true)}
                  onBlur={() =>
                    window.setTimeout(() => setShowProductSuggestions(false), 120)
                  }
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Введіть щоб знайти та додати"
                />
                <button
                  type="button"
                  className="toolbar-square-button supplier-search-add-button"
                  aria-label="Create catalog product"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setCreateCatalogProductForm({
                      name: productSearch.trim(),
                      note: '',
                    });
                    setIsCreateCatalogProductModalOpen(true);
                  }}
                >
                  +
                </button>
              </span>
            </label>
            <label className="field supplier-order-product-compact">
              <span>Ціна (UAH)</span>
              <input
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              />
            </label>
            <label className="field supplier-order-product-compact">
              <span>К-сть</span>
              <input
                value={form.quantity}
                onChange={(event) =>
                  setForm((current) => ({ ...current, quantity: event.target.value }))
                }
              />
            </label>
            <label className="field supplier-order-product-compact">
              <span>Сума</span>
              <input
                value={String(currentQuantity * currentPrice)}
                readOnly
              />
            </label>
            <button
              type="button"
              className="toolbar-square-button supplier-order-product-add"
              aria-label="Add product to order list"
              disabled={!canAddBasketItem || isAddingItem}
              onClick={async () => {
                if (!canAddBasketItem) return;
                setIsAddingItem(true);
                try {
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
                  setForm((current) => ({
                    ...current,
                    productName: '',
                    quantity: '1',
                    price: '0',
                  }));
                } catch (error) {
                  onError(
                    error instanceof Error
                      ? error.message
                      : 'Не вдалося згенерувати серійний номер.',
                  );
                } finally {
                  setIsAddingItem(false);
                }
              }}
            >
              +
            </button>
          </div>
          {showProductSuggestions &&
          (productSuggestions.length > 0 || isProductLookupLoading) ? (
            <div className="create-suggestions field-wide">
              {isProductLookupLoading ? <p>Пошук товарів...</p> : null}
              {productSuggestions.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="create-suggestion-item"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setProductSearch(product.name);
                    setShowProductSuggestions(false);
                    setForm((current) => ({
                      ...current,
                      productName: product.name,
                    }));
                  }}
                >
                  <strong>{product.name}</strong>
                  <span>{product.note || 'Product from catalog'}</span>
                </button>
              ))}
            </div>
          ) : null}
          {basketItems.length > 0 ? (
            <div className="supplier-order-basket-summary">
              <div className="supplier-order-basket-table">
                {basketItems.map((item, index) => (
                  <div key={`${item.productName}-${index}`} className="supplier-order-product-row supplier-order-basket-row">
                    <div className="supplier-order-product-index">
                      {index + 1}
                    </div>
                    <div className="field supplier-order-product-name">
                      <input value={item.productName} readOnly />
                    </div>
                    <div className="field supplier-order-product-compact">
                      <input value={String(item.price)} readOnly />
                    </div>
                    <div className="field supplier-order-product-compact">
                      <input value={String(item.quantity)} readOnly />
                    </div>
                    <div className="field supplier-order-product-compact">
                      <input value={String(item.quantity * item.price)} readOnly />
                    </div>
                    <div />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="supplier-order-total-row field-wide">
            <span>Разом</span>
            <input value={String(totalAmount)} readOnly />
          </div>
        </div>
        <footer className="catalog-edit-footer">
          <button
            type="button"
            className="primary-button"
            disabled={
              isSubmitting ||
              !selectedSupplier ||
              totalItemsToSubmit === 0 ||
              !form.deliveryDate ||
              (hasCurrentDraft && Number(form.quantity) <= 0) ||
              isAddingItem
            }
            onClick={async () => {
              const submitItems = [
                ...basketItems,
                ...(hasCurrentDraft
                  ? [
                      {
                        productName: productSearch.trim(),
                        quantity: currentQuantity,
                        price: currentPrice,
                      },
                    ]
                  : []),
              ];
              setIsSubmitting(true);
              try {
                const orderBaseId = `SO-${Date.now()}`;
                for (const [itemIndex, item] of submitItems.entries()) {
                  await onSubmit({
                    orderBaseId,
                    itemIndex,
                    supplierId: selectedSupplier?.id ?? '',
                    deliveryDate: form.deliveryDate,
                    supplyType: form.supplyType,
                    number: form.number,
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    note: form.note,
                  });
                }
                onClose();
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? 'Збереження...' : 'Створити'}
          </button>
        </footer>
      </section>

      {isCreateCatalogProductModalOpen ? (
        <div className="supplier-order-inline-backdrop" role="presentation">
          <section className="catalog-edit-modal clients-modal supplier-order-create-supplier-modal" role="dialog" aria-modal="true">
            <header className="catalog-edit-header">
              <div className="catalog-edit-title">
                <h2>Product</h2>
              </div>
              <button
                type="button"
                className="create-order-close"
                onClick={() => setIsCreateCatalogProductModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </header>
            <div className="catalog-edit-body clients-modal-body">
              <label className="field field-wide">
                <span>Product name</span>
                <input
                  value={createCatalogProductForm.name}
                  onChange={(event) =>
                    setCreateCatalogProductForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field field-wide">
                <span>Note</span>
                <textarea
                  rows={3}
                  value={createCatalogProductForm.note}
                  onChange={(event) =>
                    setCreateCatalogProductForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <footer className="catalog-edit-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsCreateCatalogProductModalOpen(false)}
                disabled={isCreateCatalogProductSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={
                  isCreateCatalogProductSaving ||
                  createCatalogProductForm.name.trim().length < 2 ||
                  hasExactProductMatch
                }
                onClick={async () => {
                  setIsCreateCatalogProductSaving(true);
                  try {
                    const created = await createCatalogProduct({
                      name: createCatalogProductForm.name.trim(),
                      note: createCatalogProductForm.note.trim(),
                      isActive: true,
                    });
                    setProductSearch(created.name);
                    setShowProductSuggestions(false);
                    setCreateCatalogProductForm({ name: '', note: '' });
                    setIsCreateCatalogProductModalOpen(false);
                    onSuccess('Product created.');
                  } catch (error) {
                    onError(
                      error instanceof Error
                        ? error.message
                        : 'Failed to create product.',
                    );
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
        <div className="supplier-order-inline-backdrop" role="presentation">
          <section className="catalog-edit-modal clients-modal supplier-order-create-supplier-modal" role="dialog" aria-modal="true">
          <header className="catalog-edit-header">
            <div className="catalog-edit-title">
              <h2>Create supplier</h2>
            </div>
            <button
              type="button"
              className="create-order-close"
              onClick={() => setIsCreateSupplierModalOpen(false)}
              aria-label="Close"
            >
              &times;
            </button>
          </header>
          <div className="catalog-edit-body clients-modal-body">
            <label className="field field-wide">
              <span>Name</span>
              <input
                value={createSupplierForm.name}
                onChange={(event) =>
                  setCreateSupplierForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field field-wide">
              <span>Phone</span>
              <input
                value={createSupplierForm.phone}
                onChange={(event) =>
                  setCreateSupplierForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field field-wide">
              <span>Note</span>
              <textarea
                rows={4}
                value={createSupplierForm.note}
                onChange={(event) =>
                  setCreateSupplierForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <footer className="catalog-edit-footer">
            <button
              type="button"
              className="primary-button"
              disabled={
                isSupplierCreating ||
                !createSupplierForm.name.trim() ||
                !createSupplierForm.phone.trim()
              }
              onClick={async () => {
                setIsSupplierCreating(true);
                const created = await onCreateSupplier({
                  name: createSupplierForm.name.trim(),
                  phone: createSupplierForm.phone.trim(),
                  note: createSupplierForm.note.trim(),
                  supplierOrder: '',
                  isActive: true,
                });

                if (created) {
                  onSuccess('Supplier created.');
                  setSupplierSearch(createSupplierForm.name.trim());
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
