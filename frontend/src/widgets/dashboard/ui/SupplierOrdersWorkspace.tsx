import { useEffect, useMemo, useState } from 'react';
import type { CatalogProduct, CatalogProductFormValues } from '../../../entities/catalog-product/model/types';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import {
  cancelSupplierOrder,
  createSupplierOrder,
  getSupplierOrders,
  takeOnChargeSupplierOrder,
  updateSupplierOrder,
} from '../../../entities/supplier-order/api/supplierOrderApi';
import type {
  SupplierOrder,
  SupplierOrderFormValues,
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from '../../../entities/supplier-order/model/types';
import { formatCurrency, formatDateTime } from '../../../shared/lib/format';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';
import { SupplierOrderModal, type SupplierOrderModalSubmitPayload } from './SupplierOrderModal';

type OrdersTab = 'orders' | 'sales' | 'supplierOrders';

type Props = {
  activeTab: OrdersTab;
  onActiveTabChange: (tab: OrdersTab) => void;
  suppliers: Supplier[];
  catalogProducts: CatalogProduct[];
  currentEmployeeName: string;
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onUpdateSupplier: (supplierId: string, payload: SupplierFormValues) => Promise<boolean>;
  onUpdateCatalogProduct: (catalogProductId: string, payload: CatalogProductFormValues) => Promise<boolean>;
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
  { key: 'paid', label: 'Сплачено' },
  { key: 'cancelled', label: 'Відмінені' },
];
const getOrderStatusLabel = (status: SupplierOrderStatus) =>
  orderStatuses.find((item) => item.key === status)?.label ?? status;

const supplierOrdersFiltersStorageKey = 'project-goods.supplier-orders-filters';

export const SupplierOrdersWorkspace = ({
  activeTab,
  onActiveTabChange,
  suppliers,
  catalogProducts,
  currentEmployeeName,
  onCreateSupplier,
  onUpdateSupplier,
  onUpdateCatalogProduct,
  onSuccess,
  onError,
}: Props) => {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);

  const [selectedSupplierForEdit, setSelectedSupplierForEdit] = useState<Supplier | null>(null);
  const [selectedCatalogProductForEdit, setSelectedCatalogProductForEdit] = useState<CatalogProduct | null>(null);
  const [supplierEditForm, setSupplierEditForm] = useState({ name: '', phone: '', note: '', isActive: true });
  const [productEditForm, setProductEditForm] = useState({ name: '', note: '', isActive: true });
  const [isSupplierSaving, setIsSupplierSaving] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);

  const refreshOrders = async () => {
    setIsLoading(true);
    try {
      const loaded = await getSupplierOrders();
      setOrders(loaded);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load supplier orders.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (normalized) {
        const text = [
          ...order.items.map((item) => item.productName),
          order.supplierName,
          order.orderBaseId,
          order.number,
        ]
          .join(' ')
          .toLowerCase();
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
    window.localStorage.setItem(supplierOrdersFiltersStorageKey, JSON.stringify({ query, selectedStatuses, paymentStatus }));
  }, [paymentStatus, query, selectedStatuses]);

  useEffect(() => {
    if (!selectedSupplierForEdit) return;
    setSupplierEditForm({
      name: selectedSupplierForEdit.name,
      phone: selectedSupplierForEdit.phone,
      note: selectedSupplierForEdit.note,
      isActive: selectedSupplierForEdit.isActive,
    });
  }, [selectedSupplierForEdit]);

  useEffect(() => {
    if (!selectedCatalogProductForEdit) return;
    setProductEditForm({
      name: selectedCatalogProductForEdit.name,
      note: selectedCatalogProductForEdit.note,
      isActive: selectedCatalogProductForEdit.isActive,
    });
  }, [selectedCatalogProductForEdit]);

  const groupedOrderView = (order: SupplierOrder) =>
    order.items.map((item) => ({
      id: `${order.orderBaseId}-${item.itemIndex + 1}`,
      item,
      order,
    }));

  return (
    <section className='orders-page'>
      <div className='orders-tabs' role='tablist' aria-label='Order categories'>
        {tabs.map((tab) => (
          <button key={tab.key} type='button' className={tab.key === activeTab ? 'orders-tab orders-tab-active' : 'orders-tab'} onClick={() => onActiveTabChange(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className='orders-toolbar'>
        <div className='orders-toolbar-left'>
          <div className='orders-search-group orders-search-group-clearable'>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder='Пошук' />
            {query ? (
              <span
                role='button'
                tabIndex={0}
                className='orders-search-clear'
                aria-label='Clear search text'
                onClick={() => { setQuery(''); setPage(1); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setQuery('');
                    setPage(1);
                  }
                }}
              >
                x
              </span>
            ) : null}
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
                  <label key={status.key}><input type='checkbox' checked={selectedStatuses.includes(status.key)} onChange={() => toggleStatus(status.key)} /><span>{status.label}</span></label>
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
                <label><input type='radio' checked={paymentStatus === 'all'} onChange={() => setPaymentStatus('all')} /><span>Всі статуси оплати</span></label>
                {filteredPaymentStatuses.map((status) => (
                  <label key={status.key}><input type='radio' checked={paymentStatus === status.key} onChange={() => setPaymentStatus(status.key)} /><span>{status.label}</span></label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className='orders-toolbar-actions'>
          <button type='button' className='orders-create-button' onClick={() => { setEditingOrder(null); setIsModalOpen(true); }}>
            Замовити у постачальника
          </button>
        </div>
      </div>

      <div className='orders-table-wrap'>
        <table className='orders-table'>
          <thead>
            <tr>
              <th>№</th><th>Товар</th><th>К-сть</th><th>Ціна</th><th>Вартість</th><th>Сплачено</th><th>Постачальник</th><th>Дата пост.</th><th>Статус</th><th>Статус оплати</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.flatMap((order) =>
              groupedOrderView(order).map(({ id, item }) => (
                <tr key={id}>
                  <td><button type='button' className='catalog-name-button' onClick={() => { if (order.paymentStatus === 'paid') return; setEditingOrder(order); setIsModalOpen(true); }}>{id}</button></td>
                  <td>
                    <button type='button' className='catalog-name-button' onClick={() => {
                      const matchedProduct = item.catalogProductId
                        ? catalogProducts.find(
                            (product) =>
                              product.id === item.catalogProductId,
                          )
                        : catalogProducts.find((product) => product.name.trim().toLowerCase() === item.productName.trim().toLowerCase());
                      if (!matchedProduct) {
                        onError('Товар не знайдено в Products каталозі.');
                        return;
                      }
                      setSelectedCatalogProductForEdit(matchedProduct);
                    }}>{item.productName}</button>
                  </td>
                  <td>{item.quantity} шт</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>{formatCurrency(item.quantity * item.price)}</td>
                  <td>{formatCurrency(order.paid)}</td>
                  <td>
                    <button type='button' className='catalog-name-button' onClick={() => {
                      const matchedSupplier = suppliers.find((supplier) => supplier.id === order.supplierId);
                      if (!matchedSupplier) {
                        onError('Постачальника не знайдено.');
                        return;
                      }
                      setSelectedSupplierForEdit(matchedSupplier);
                    }}>{order.supplierName}</button>
                  </td>
                  <td>{formatDateTime(order.deliveryDate)}</td>
                  <td>
                    {order.status === 'stocked' ||
                    order.status === 'cancelled' ||
                    order.paymentStatus === 'cancelled' ? (
                      <input
                        value={getOrderStatusLabel(order.status)}
                        readOnly
                      />
                    ) : (
                      <select
                        value={order.status}
                        disabled={order.paymentStatus === 'paid'}
                        onChange={async (event) => {
                          try {
                            await updateSupplierOrder(order.id, {
                              orderBaseId: order.orderBaseId,
                              supplierId: order.supplierId,
                              deliveryDate: order.deliveryDate.slice(0, 10),
                              supplyType: order.supplyType,
                              number: order.number,
                              note: order.note,
                              createdBy: order.createdBy,
                              paymentStatus: order.paymentStatus,
                              status: event.target.value as SupplierOrderStatus,
                              items: order.items,
                            });
                            await refreshOrders();
                            onSuccess('Статус замовлення оновлено.');
                          } catch (error) {
                            onError(error instanceof Error ? error.message : 'Не вдалося оновити статус замовлення.');
                          }
                        }}
                      >
                        {orderStatuses.map((status) => (
                          <option key={status.key} value={status.key}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>{paymentStatuses.find((status) => status.key === order.paymentStatus)?.label ?? order.paymentStatus}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
        {isLoading ? <p className='orders-empty'>Завантаження...</p> : null}
        {!isLoading && paginatedOrders.length === 0 ? <p className='orders-empty'>Немає замовлень постачальникам.</p> : null}
      </div>

      <PaginationPanel totalItems={filteredOrders.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); }} />

      <SupplierOrderModal
        isOpen={isModalOpen}
        suppliers={suppliers}
        editingOrder={editingOrder}
        forceReadOnly={Boolean(
          editingOrder &&
            (editingOrder.status === 'stocked' ||
              editingOrder.receiptStatus === 'received' ||
              editingOrder.status === 'cancelled' ||
              editingOrder.paymentStatus === 'cancelled'),
        )}
        onClose={() => { setIsModalOpen(false); setEditingOrder(null); }}
        onCreateSupplier={onCreateSupplier}
        onSuccess={onSuccess}
        onError={onError}
        onTakeOnCharge={async () => {
          if (!editingOrder) return;
          await takeOnChargeSupplierOrder(editingOrder.id);
          onSuccess('Замовлення оприбутковано.');
          window.dispatchEvent(new Event('project-goods:finance-updated'));
          window.dispatchEvent(new Event('project-goods:products-updated'));
          await refreshOrders();
        }}
        onCancelOrder={async () => {
          if (!editingOrder) return;
          await cancelSupplierOrder(editingOrder.id);
          onSuccess('Замовлення скасовано.');
          await refreshOrders();
        }}
        onSubmit={async (payload: SupplierOrderModalSubmitPayload) => {
          try {
            const basePayload: SupplierOrderFormValues = {
              supplierId: payload.supplierId,
              deliveryDate: payload.deliveryDate,
              supplyType: payload.supplyType,
              number: payload.number,
              note: payload.note,
              createdBy: currentEmployeeName,
              items: payload.items,
            };

            if (!editingOrder) {
              await createSupplierOrder({ ...basePayload, orderBaseId: `SO-${Date.now()}` });
              onSuccess('Supplier order created.');
            } else {
              await updateSupplierOrder(editingOrder.id, { ...basePayload, orderBaseId: editingOrder.orderBaseId });
              onSuccess('Supplier order updated.');
            }
            await refreshOrders();
          } catch (error) {
            onError(error instanceof Error ? error.message : 'Failed to save supplier order.');
          }
        }}
      />

      {selectedSupplierForEdit ? (
        <div className='modal-backdrop' role='presentation' onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSupplierForEdit(null); }}>
          <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
            <header className='catalog-edit-header'><div className='catalog-edit-title'><h2>Supplier</h2></div><button type='button' className='create-order-close' onClick={() => setSelectedSupplierForEdit(null)} aria-label='Close'>&times;</button></header>
            <div className='catalog-edit-body'>
              <label className='field'><span>Name</span><input value={supplierEditForm.name} onChange={(event) => setSupplierEditForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className='field'><span>Phone</span><input value={supplierEditForm.phone} onChange={(event) => setSupplierEditForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label className='field field-wide'><span>Note</span><textarea rows={3} value={supplierEditForm.note} onChange={(event) => setSupplierEditForm((current) => ({ ...current, note: event.target.value }))} /></label>
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={isSupplierSaving || supplierEditForm.name.trim().length < 2 || supplierEditForm.phone.trim().length < 3}
                onClick={async () => {
                  if (!selectedSupplierForEdit) return;
                  setIsSupplierSaving(true);
                  const ok = await onUpdateSupplier(selectedSupplierForEdit.id, { name: supplierEditForm.name.trim(), phone: supplierEditForm.phone.trim(), note: supplierEditForm.note.trim(), supplierOrder: selectedSupplierForEdit.supplierOrder, isActive: supplierEditForm.isActive });
                  setIsSupplierSaving(false);
                  if (!ok) return;
                  onSuccess('Supplier updated.');
                  await refreshOrders();
                  setSelectedSupplierForEdit(null);
                }}
              >
                {isSupplierSaving ? 'Saving...' : 'Save'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {selectedCatalogProductForEdit ? (
        <div className='modal-backdrop' role='presentation' onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCatalogProductForEdit(null); }}>
          <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
            <header className='catalog-edit-header'><div className='catalog-edit-title'><h2>Product</h2></div><button type='button' className='create-order-close' onClick={() => setSelectedCatalogProductForEdit(null)} aria-label='Close'>&times;</button></header>
            <div className='catalog-edit-body'>
              <label className='field'><span>Product name</span><input value={productEditForm.name} onChange={(event) => setProductEditForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className='field field-wide'><span>Note</span><textarea rows={3} value={productEditForm.note} onChange={(event) => setProductEditForm((current) => ({ ...current, note: event.target.value }))} /></label>
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={isProductSaving || productEditForm.name.trim().length < 2}
                onClick={async () => {
                  if (!selectedCatalogProductForEdit) return;
                  setIsProductSaving(true);
                  const ok = await onUpdateCatalogProduct(selectedCatalogProductForEdit.id, { name: productEditForm.name.trim(), note: productEditForm.note.trim(), isActive: productEditForm.isActive });
                  setIsProductSaving(false);
                  if (!ok) return;
                  onSuccess('Product updated.');
                  await refreshOrders();
                  setSelectedCatalogProductForEdit(null);
                }}
              >
                {isProductSaving ? 'Saving...' : 'Save'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
};

