import { useEffect, useMemo, useState } from 'react';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';

export type SupplierOrderModalSubmitPayload = {
  supplierId: string;
  deliveryDate: string;
  supplyType: string;
  number: string;
  serialNumber: string;
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
  const serialAutoMax = 999999;
  const makeSerialByIndex = (value: number) =>
    `S${Math.max(0, value).toString().padStart(6, '0')}`;
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
  const [autoGenerateSerial, setAutoGenerateSerial] = useState(false);
  const [serialSeed, setSerialSeed] = useState(() =>
    Math.floor(Math.random() * (serialAutoMax + 1)),
  );
  const [basketItems, setBasketItems] = useState<
    Array<{
      productName: string;
      quantity: number;
      price: number;
      serialNumber: string;
    }>
  >([]);
  const [form, setForm] = useState({
    deliveryDate: '',
    supplyType: 'Локально',
    number: '',
    serialNumber: '',
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
    setAutoGenerateSerial(false);
    setBasketItems([]);
    setForm({
      deliveryDate: '',
      supplyType: 'Локально',
      number: '',
      serialNumber: '',
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
  const canAddBasketItem = !!form.productName.trim() && currentQuantity > 0;
  const hasCurrentDraft = !!form.productName.trim();
  const totalItemsToSubmit = basketItems.length + (hasCurrentDraft ? 1 : 0);

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
          <div className="create-device-search">
            <label className="field">
              <span>Постачальник</span>
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
            </label>
            <button
              type="button"
              className="toolbar-square-button"
              aria-label="Create supplier"
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
          </div>
          {showSupplierSuggestions && supplierOptions.length > 0 ? (
            <div className="create-suggestions">
              {supplierOptions.map((supplier) => (
                <button
                  key={supplier.id}
                  type="button"
                  className="create-suggestion-item"
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
          <label className="field">
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
          <label className="field">
            <span>Серійний номер</span>
            <input
              value={form.serialNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, serialNumber: event.target.value }))
              }
              disabled={autoGenerateSerial}
              placeholder="S000000"
            />
          </label>
          <label className="field field-wide supplier-serial-auto-row">
            <span className="supplier-serial-auto">
              <input
                type="checkbox"
                checked={autoGenerateSerial}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setAutoGenerateSerial(checked);
                  if (checked) {
                    const next = (serialSeed + 1) % (serialAutoMax + 1);
                    setSerialSeed(next);
                    setForm((current) => ({
                      ...current,
                      serialNumber: makeSerialByIndex(next),
                    }));
                  }
                }}
              />
              <span>Згенерувати унікальний серійник (S000000)</span>
            </span>
          </label>
          <label className="field field-wide">
            <span>Примітка</span>
            <textarea
              rows={2}
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            />
          </label>
          <div className="create-device-search field-wide">
            <label className="field">
              <span>Товар</span>
              <input
                value={form.productName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, productName: event.target.value }))
                }
                placeholder="Введіть щоб знайти та додати"
              />
            </label>
            <button
              type="button"
              className="toolbar-square-button"
              aria-label="Add product to order list"
              disabled={!canAddBasketItem}
              onClick={() => {
                if (!canAddBasketItem) return;
                setBasketItems((current) => [
                  ...current,
                  {
                    productName: form.productName.trim(),
                    quantity: currentQuantity,
                    price: currentPrice,
                    serialNumber: form.serialNumber.trim().toUpperCase(),
                  },
                ]);
                setForm((current) => ({
                  ...current,
                  productName: '',
                  quantity: '1',
                  price: '0',
                  serialNumber: autoGenerateSerial
                    ? makeSerialByIndex((serialSeed + 1) % (serialAutoMax + 1))
                    : '',
                }));
                if (autoGenerateSerial) {
                  setSerialSeed((current) => (current + 1) % (serialAutoMax + 1));
                }
              }}
            >
              +
            </button>
          </div>
          {basketItems.length > 0 ? (
            <div className="supplier-order-basket-summary">Кошик: {basketItems.length} позицій</div>
          ) : null}
          <label className="field">
            <span>Ціна (UAH)</span>
            <input
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>К-сть</span>
            <input
              value={form.quantity}
              onChange={(event) =>
                setForm((current) => ({ ...current, quantity: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Сума</span>
            <input
              value={String(currentQuantity * currentPrice)}
              readOnly
            />
          </label>
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
              (hasCurrentDraft && Number(form.quantity) <= 0)
            }
            onClick={async () => {
              const submitItems = [
                ...basketItems,
                ...(hasCurrentDraft
                  ? [
                      {
                        productName: form.productName.trim(),
                        quantity: currentQuantity,
                        price: currentPrice,
                        serialNumber: form.serialNumber.trim().toUpperCase(),
                      },
                    ]
                  : []),
              ];
              setIsSubmitting(true);
              try {
                for (const item of submitItems) {
                  await onSubmit({
                    supplierId: selectedSupplier?.id ?? '',
                    deliveryDate: form.deliveryDate,
                    supplyType: form.supplyType,
                    number: form.number,
                    serialNumber: item.serialNumber,
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

      {isCreateSupplierModalOpen ? (
        <section className="catalog-edit-modal clients-modal" role="dialog" aria-modal="true">
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
      ) : null}
    </div>
  );
};
