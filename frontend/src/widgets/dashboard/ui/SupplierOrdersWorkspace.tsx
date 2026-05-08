import { useEffect, useMemo, useState } from 'react';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import { formatCurrency, formatDateTime } from '../../../shared/lib/format';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';

type OrdersTab = 'orders' | 'sales' | 'supplierOrders';
type SupplierOrderStatus = 'request' | 'ordered' | 'approved' | 'stocked' | 'overdue' | 'cancelled' | 'unavailable';
type SupplierPaymentStatus = 'pending' | 'paid' | 'cancelled';

type SupplierOrder = {
  id: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  paid: number;
  status: SupplierOrderStatus;
  paymentStatus: SupplierPaymentStatus;
  deliveryDate: string;
  createdBy: string;
};

type Props = {
  activeTab: OrdersTab;
  onActiveTabChange: (tab: OrdersTab) => void;
  suppliers: Supplier[];
  currentEmployeeName: string;
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onUpdateSupplier: (clientId: string, payload: SupplierFormValues) => Promise<boolean>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

const tabs: Array<{ key: OrdersTab; label: string }> = [
  { key: 'orders', label: 'Orders' },
  { key: 'sales', label: 'Sales' },
  { key: 'supplierOrders', label: 'Supplier Order' },
];

const orderStatuses: Array<{ key: SupplierOrderStatus; label: string }> = [
  { key: 'request', label: 'Запит на закупівлю' },
  { key: 'ordered', label: 'Товар замовлений' },
  { key: 'approved', label: 'Затверджено' },
  { key: 'stocked', label: 'Оприбутковано' },
  { key: 'overdue', label: 'Протермінований' },
  { key: 'cancelled', label: 'Скасований' },
  { key: 'unavailable', label: 'Недоступний' },
];

const paymentStatuses: Array<{ key: SupplierPaymentStatus; label: string }> = [
  { key: 'pending', label: 'Очікують оплати' },
  { key: 'paid', label: 'Оплачені' },
  { key: 'cancelled', label: 'Відмінені' },
];

const getAutoPaymentStatus = (status: SupplierOrderStatus): SupplierPaymentStatus => {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'approved' || status === 'stocked') return 'paid';
  return 'pending';
};

const supplierOrdersFiltersStorageKey = 'project-goods.supplier-orders-filters';

export const SupplierOrdersWorkspace = ({
  activeTab,
  onActiveTabChange,
  suppliers,
  currentEmployeeName,
  onCreateSupplier,
  onUpdateSupplier,
  onSuccess,
  onError,
}: Props) => {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(supplierOrdersFiltersStorageKey) ?? '{}') as Partial<{ query: string }>;
      return parsed.query ?? '';
    } catch {
      return '';
    }
  });
  const [selectedStatuses, setSelectedStatuses] = useState<SupplierOrderStatus[]>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(supplierOrdersFiltersStorageKey) ?? '{}') as Partial<{ selectedStatuses: SupplierOrderStatus[] }>;
      return Array.isArray(parsed.selectedStatuses) ? parsed.selectedStatuses : [];
    } catch {
      return [];
    }
  });
  const [paymentStatus, setPaymentStatus] = useState<SupplierPaymentStatus | 'all'>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(supplierOrdersFiltersStorageKey) ?? '{}') as Partial<{ paymentStatus: SupplierPaymentStatus | 'all' }>;
      return parsed.paymentStatus === 'pending' || parsed.paymentStatus === 'paid' || parsed.paymentStatus === 'cancelled' || parsed.paymentStatus === 'all'
        ? parsed.paymentStatus
        : 'all';
    } catch {
      return 'all';
    }
  });
  const [isOrderStatusOpen, setIsOrderStatusOpen] = useState(false);
  const [isPaymentStatusOpen, setIsPaymentStatusOpen] = useState(false);
  const [statusQuery, setStatusQuery] = useState('');
  const [paymentQuery, setPaymentQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [addSupplierForm, setAddSupplierForm] = useState({ name: '', phone: '+380' });
  const [isSupplierCreating, setIsSupplierCreating] = useState(false);
  const [form, setForm] = useState({
    supplierId: '',
    deliveryDate: '',
    supplyType: 'Локально',
    number: '',
    productName: '',
    quantity: '1',
    price: '0',
    note: '',
  });

  const supplierOptions = useMemo(() => {
    const normalized = supplierSearch.trim().toLowerCase();
    return normalized
      ? suppliers.filter((supplier) => [supplier.name, supplier.phone].join(' ').toLowerCase().includes(normalized))
      : suppliers;
  }, [supplierSearch, suppliers]);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (normalized) {
        const text = [order.productName, order.supplierName, order.id].join(' ').toLowerCase();
        if (!text.includes(normalized)) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(order.status)) return false;
      if (paymentStatus !== 'all' && order.paymentStatus !== paymentStatus) return false;
      return true;
    });
  }, [orders, paymentStatus, query, selectedStatuses]);

  const filteredOrderStatuses = useMemo(() => {
    const normalized = statusQuery.trim().toLowerCase();
    return normalized ? orderStatuses.filter((item) => item.label.toLowerCase().includes(normalized)) : orderStatuses;
  }, [statusQuery]);

  const filteredPaymentStatuses = useMemo(() => {
    const normalized = paymentQuery.trim().toLowerCase();
    return normalized ? paymentStatuses.filter((item) => item.label.toLowerCase().includes(normalized)) : paymentStatuses;
  }, [paymentQuery]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  const toggleStatus = (status: SupplierOrderStatus) => {
    setSelectedStatuses((current) => (current.includes(status) ? current.filter((item) => item !== status) : [...current, status]));
    setPage(1);
  };

  useEffect(() => {
    window.localStorage.setItem(
      supplierOrdersFiltersStorageKey,
      JSON.stringify({
        query,
        selectedStatuses,
        paymentStatus,
      }),
    );
  }, [paymentStatus, query, selectedStatuses]);

  return (
    <section className='orders-page'>
      <div className='orders-tabs' role='tablist' aria-label='Order categories'>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type='button'
            className={tab.key === activeTab ? 'orders-tab orders-tab-active' : 'orders-tab'}
            onClick={() => onActiveTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className='orders-toolbar'>
        <div className='orders-toolbar-left'>
          <div className='orders-search-group'>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder='Пошук' />
            <button type='button'>Find</button>
          </div>

          <div className='orders-filter-field orders-filter-status-field'>
            <button type='button' className='orders-filter-status-toggle' aria-expanded={isOrderStatusOpen} onClick={() => setIsOrderStatusOpen((current) => !current)}>
              Статус замовлення
            </button>
            {isOrderStatusOpen ? (
              <div className='orders-filter-status-menu'>
                <input value={statusQuery} onChange={(event) => setStatusQuery(event.target.value)} placeholder='Пошук' />
                <label className='orders-filter-status-all'>
                  <input type='checkbox' checked={selectedStatuses.length === orderStatuses.length} onChange={() => setSelectedStatuses((current) => current.length === orderStatuses.length ? [] : orderStatuses.map((item) => item.key))} />
                  <span>Обрати все</span>
                </label>
                {filteredOrderStatuses.map((status) => (
                  <label key={status.key}>
                    <input type='checkbox' checked={selectedStatuses.includes(status.key)} onChange={() => toggleStatus(status.key)} />
                    <span>{status.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div className='orders-filter-field orders-filter-status-field'>
            <button type='button' className='orders-filter-status-toggle' aria-expanded={isPaymentStatusOpen} onClick={() => setIsPaymentStatusOpen((current) => !current)}>
              {paymentStatus === 'all' ? 'Всі статуси оплати' : paymentStatuses.find((item) => item.key === paymentStatus)?.label}
            </button>
            {isPaymentStatusOpen ? (
              <div className='orders-filter-status-menu'>
                <input value={paymentQuery} onChange={(event) => setPaymentQuery(event.target.value)} placeholder='Пошук' />
                <label>
                  <input type='radio' checked={paymentStatus === 'all'} onChange={() => setPaymentStatus('all')} />
                  <span>Всі статуси оплати</span>
                </label>
                {filteredPaymentStatuses.map((status) => (
                  <label key={status.key}>
                    <input type='radio' checked={paymentStatus === status.key} onChange={() => setPaymentStatus(status.key)} />
                    <span>{status.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className='orders-toolbar-actions'>
          <button type='button' className='orders-create-button' onClick={() => setIsModalOpen(true)}>
            Замовити у постачальника
          </button>
        </div>
      </div>

      <div className='orders-table-wrap'>
        <table className='orders-table'>
          <thead>
            <tr>
              <th>№</th>
              <th>Товар</th>
              <th>К-сть</th>
              <th>Ціна</th>
              <th>Вартість</th>
              <th>Сплачено</th>
              <th>Постачальник</th>
              <th>Дата пост.</th>
              <th>Статус</th>
              <th>Статус оплати</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.productName}</td>
                <td>{order.quantity} шт</td>
                <td>{formatCurrency(order.price)}</td>
                <td>{formatCurrency(order.total)}</td>
                <td>{formatCurrency(order.paid)}</td>
                <td>{order.supplierName}</td>
                <td>{formatDateTime(order.deliveryDate)}</td>
                <td>{orderStatuses.find((status) => status.key === order.status)?.label ?? order.status}</td>
                <td>{paymentStatuses.find((status) => status.key === order.paymentStatus)?.label ?? order.paymentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {paginatedOrders.length === 0 ? <p className='orders-empty'>Немає замовлень постачальникам.</p> : null}
      </div>

      <PaginationPanel
        totalItems={filteredOrders.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); }}
      />

      {isModalOpen ? (
        <div className='modal-backdrop' role='presentation'>
          <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
            <header className='catalog-edit-header'>
              <div className='catalog-edit-title'><h2>Замовити у постачальника</h2></div>
              <button type='button' className='create-order-close' onClick={() => setIsModalOpen(false)} aria-label='Close'>&times;</button>
            </header>
            <div className='catalog-edit-body'>
              <label className='field'><span>Постачальник</span><input value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder='Пошук' /></label>
              <label className='field'><span>Обрати</span><select value={form.supplierId} onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))}><option value=''>Не обрано</option>{supplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
              <label className='field'><span>Дата поставки</span><input type='date' value={form.deliveryDate} onChange={(event) => setForm((current) => ({ ...current, deliveryDate: event.target.value }))} /></label>
              <label className='field'><span>Тип поставки</span><select value={form.supplyType} onChange={(event) => setForm((current) => ({ ...current, supplyType: event.target.value }))}><option>Локально</option><option>Закордон</option></select></label>
              <label className='field'><span>Номер</span><input value={form.number} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} /></label>
              <label className='field field-wide'><span>Примітка</span><textarea rows={2} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></label>
              <label className='field field-wide'><span>Товар</span><input value={form.productName} onChange={(event) => setForm((current) => ({ ...current, productName: event.target.value }))} placeholder='Введіть щоб знайти та додати' /></label>
              <label className='field'><span>Ціна (UAH)</span><input value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} /></label>
              <label className='field'><span>К-сть</span><input value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
              <label className='field'><span>Сума</span><input value={String(Math.max(0, Number(form.quantity) || 0) * Math.max(0, Number(form.price) || 0))} readOnly /></label>
              <label className='field'><span>Додати постачальника</span><input value={addSupplierForm.name} onChange={(event) => setAddSupplierForm((current) => ({ ...current, name: event.target.value }))} placeholder='Назва' /></label>
              <label className='field'><span>Телефон</span><input value={addSupplierForm.phone} onChange={(event) => setAddSupplierForm((current) => ({ ...current, phone: event.target.value }))} /></label>
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='secondary-button'
                disabled={isSupplierCreating || !addSupplierForm.name.trim() || !addSupplierForm.phone.trim()}
                onClick={async () => {
                  if (!addSupplierForm.name.trim() || !addSupplierForm.phone.trim()) return;
                  setIsSupplierCreating(true);
                  const created = await onCreateSupplier({ name: addSupplierForm.name.trim(), phone: addSupplierForm.phone.trim(), note: '', isActive: true });
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
                type='button'
                className='primary-button'
                disabled={!form.productName.trim() || !form.deliveryDate || Number(form.quantity) <= 0}
                onClick={async () => {
                  const supplier = suppliers.find((item) => item.id === form.supplierId);
                  const quantity = Math.max(1, Number(form.quantity) || 1);
                  const price = Math.max(0, Number(form.price) || 0);
                  const status: SupplierOrderStatus = 'request';
                  const autoPaymentStatus = getAutoPaymentStatus(status);
                  setOrders((current) => [{
                    id: `SO-${Date.now()}`,
                    supplierId: supplier?.id ?? '',
                    supplierName: supplier?.name ?? 'Не обрано',
                    productName: form.productName.trim(),
                    quantity,
                    price,
                    total: quantity * price,
                    paid: autoPaymentStatus === 'paid' ? quantity * price : 0,
                    status,
                    paymentStatus: autoPaymentStatus,
                    deliveryDate: form.deliveryDate,
                    createdBy: currentEmployeeName,
                  }, ...current]);

                  if (supplier?.id) {
                    await onUpdateSupplier(supplier.id, {
                      name: supplier.name,
                      phone: supplier.phone,
                      note: supplier.note,
                      isActive: supplier.isActive,
                    });
                  }

                  setIsModalOpen(false);
                  setForm({ supplierId: '', deliveryDate: '', supplyType: 'Локально', number: '', productName: '', quantity: '1', price: '0', note: '' });
                }}
              >
                Створити
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
};

