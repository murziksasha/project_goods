import { useEffect, useMemo, useState } from 'react';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';

export type SupplierOrderModalSubmitPayload = {
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
  const [supplierSearch, setSupplierSearch] = useState('');
  const [addSupplierForm, setAddSupplierForm] = useState({ name: '', phone: '+380' });
  const [isSupplierCreating, setIsSupplierCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    supplierId: '',
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
    setAddSupplierForm({ name: '', phone: '+380' });
    setForm({
      supplierId: '',
      deliveryDate: '',
      supplyType: 'Локально',
      number: '',
      productName: initialProductName,
      quantity: '1',
      price: '0',
      note: '',
    });
  }, [initialProductName, isOpen]);

  const supplierOptions = useMemo(() => {
    const normalized = supplierSearch.trim().toLowerCase();
    return normalized
      ? suppliers.filter((supplier) =>
          [supplier.name, supplier.phone].join(' ').toLowerCase().includes(normalized),
        )
      : suppliers;
  }, [supplierSearch, suppliers]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="catalog-edit-modal" role="dialog" aria-modal="true">
        <header className="catalog-edit-header">
          <div className="catalog-edit-title">
            <h2>Замовити у постачальника</h2>
          </div>
          <button type="button" className="create-order-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>
        <div className="catalog-edit-body">
          <label className="field">
            <span>Постачальник</span>
            <input
              value={supplierSearch}
              onChange={(event) => setSupplierSearch(event.target.value)}
              placeholder="Пошук"
            />
          </label>
          <label className="field">
            <span>Обрати</span>
            <select
              value={form.supplierId}
              onChange={(event) =>
                setForm((current) => ({ ...current, supplierId: event.target.value }))
              }
            >
              <option value="">Не обрано</option>
              {supplierOptions.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
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
          <label className="field field-wide">
            <span>Примітка</span>
            <textarea
              rows={2}
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            />
          </label>
          <label className="field field-wide">
            <span>Товар</span>
            <input
              value={form.productName}
              onChange={(event) =>
                setForm((current) => ({ ...current, productName: event.target.value }))
              }
              placeholder="Введіть щоб знайти та додати"
            />
          </label>
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
              value={String(Math.max(0, Number(form.quantity) || 0) * Math.max(0, Number(form.price) || 0))}
              readOnly
            />
          </label>
          <label className="field">
            <span>Додати постачальника</span>
            <input
              value={addSupplierForm.name}
              onChange={(event) =>
                setAddSupplierForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Назва"
            />
          </label>
          <label className="field">
            <span>Телефон</span>
            <input
              value={addSupplierForm.phone}
              onChange={(event) =>
                setAddSupplierForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </label>
        </div>
        <footer className="catalog-edit-footer">
          <button
            type="button"
            className="secondary-button"
            disabled={isSupplierCreating || !addSupplierForm.name.trim() || !addSupplierForm.phone.trim()}
            onClick={async () => {
              if (!addSupplierForm.name.trim() || !addSupplierForm.phone.trim()) return;
              setIsSupplierCreating(true);
              const created = await onCreateSupplier({
                name: addSupplierForm.name.trim(),
                phone: addSupplierForm.phone.trim(),
                note: '',
                isActive: true,
              });
              if (created) {
                onSuccess('Постачальника додано.');
                setAddSupplierForm({ name: '', phone: '+380' });
              } else {
                onError('Не вдалося створити постачальника. Перевірте телефон або дублікати.');
              }
              setIsSupplierCreating(false);
            }}
          >
            {isSupplierCreating ? 'Створення...' : 'Додати постачальника'}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={isSubmitting || !form.productName.trim() || !form.deliveryDate || Number(form.quantity) <= 0}
            onClick={async () => {
              const quantity = Math.max(1, Number(form.quantity) || 1);
              const price = Math.max(0, Number(form.price) || 0);
              setIsSubmitting(true);
              try {
                await onSubmit({
                  supplierId: form.supplierId,
                  deliveryDate: form.deliveryDate,
                  supplyType: form.supplyType,
                  number: form.number,
                  productName: form.productName.trim(),
                  quantity,
                  price,
                  note: form.note,
                });
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
    </div>
  );
};
