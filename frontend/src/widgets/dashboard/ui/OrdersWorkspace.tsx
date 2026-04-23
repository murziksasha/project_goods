import { useMemo, useState } from 'react';
import type { Sale } from '../../../entities/sale/model/types';
import { isRepairOrder } from '../../../entities/sale/lib/sale-kind';

type OrdersWorkspaceProps = {
  sales: Sale[];
  isLoading: boolean;
  searchValue: string;
  isSeeding: boolean;
  onSearchChange: (value: string) => void;
  onCreateOrder: () => void;
  onSeedDemoData: () => void;
};

type OrdersTab = 'orders' | 'sales';

const orderTabs: Array<{ key: OrdersTab; label: string }> = [
  { key: 'orders', label: 'Orders' },
  { key: 'sales', label: 'Sales' },
];

const orderStatuses = ['New repair', 'In other service', 'Ready', 'Waiting parts'] as const;

const buildOrderNumber = (sale: Sale, index: number) => {
  return sale.recordNumber ?? `r${String(index + 1).padStart(6, '0')}`;
};

const pickStatus = (sale: Sale, index: number) => {
  const seed = sale.product.name.length + sale.client.name.length + index;
  return orderStatuses[seed % orderStatuses.length];
};

const formatReadyDate = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));

export const OrdersWorkspace = ({
  sales,
  isLoading,
  searchValue,
  isSeeding,
  onSearchChange,
  onCreateOrder,
  onSeedDemoData,
}: OrdersWorkspaceProps) => {
  const [activeTab, setActiveTab] = useState<OrdersTab>('orders');

  const filteredOrders = useMemo(() => {
    const tabSales = sales.filter((sale) =>
      activeTab === 'orders' ? isRepairOrder(sale) : !isRepairOrder(sale),
    );
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return tabSales;
    }

    return tabSales.filter((sale, index) => {
      const orderNumber = buildOrderNumber(sale, index);
      return (
        String(orderNumber).includes(query) ||
        sale.product.name.toLowerCase().includes(query) ||
        sale.client.name.toLowerCase().includes(query) ||
        sale.client.phone.toLowerCase().includes(query)
      );
    });
  }, [activeTab, sales, searchValue]);

  return (
    <section className="orders-page">
      <div className="orders-tabs" role="tablist" aria-label="Order categories">
        {orderTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={tab.key === activeTab ? 'orders-tab orders-tab-active' : 'orders-tab'}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="orders-toolbar">
        <div className="orders-toolbar-left">
          <button type="button" className="toolbar-square-button" aria-label="Filters">
            ⚙
          </button>
          <button type="button" className="toolbar-filter-button">
            Filter
          </button>
          <div className="orders-search-group">
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by order, client or device"
              aria-label="Search orders"
            />
            <button type="button">Find</button>
          </div>
        </div>
        <div className="orders-toolbar-actions">
          <button
            type="button"
            className="toolbar-filter-button"
            onClick={onSeedDemoData}
            disabled={isSeeding}
          >
            {isSeeding ? 'Loading...' : 'Demo data'}
          </button>
          <button type="button" className="orders-create-button" onClick={onCreateOrder}>
            Create order
          </button>
        </div>
      </div>

      <div className="orders-table-wrap">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Receiver</th>
              <th>Manager</th>
              <th>Master</th>
              <th>Status</th>
              <th>Device</th>
              <th>Price</th>
              <th>Paid</th>
              <th>Client</th>
              <th>Term</th>
              <th>Warehouse</th>
              <th>Ready date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={12} className="orders-empty">
                  Loading orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={12} className="orders-empty">
                  {activeTab === 'orders' ? 'Orders not found.' : 'Sales not found.'}
                </td>
              </tr>
            ) : (
              filteredOrders.map((sale, index) => {
                const status = pickStatus(sale, index);
                return (
                  <tr key={sale.id}>
                    <td>{buildOrderNumber(sale, index)}</td>
                    <td>{sale.client.name}</td>
                    <td>{sale.manager?.name || '-'}</td>
                    <td>{sale.master?.name || '-'}</td>
                    <td>
                      <span className={`order-status order-status-${index % 4}`}>{status}</span>
                    </td>
                    <td>{sale.product.name}</td>
                    <td>{sale.salePrice}</td>
                    <td>{sale.salePrice * sale.quantity}</td>
                    <td>
                      <div className="orders-client-cell">
                        <span>{sale.client.name}</span>
                        <small>{sale.client.phone}</small>
                      </div>
                    </td>
                    <td>Non-urgent</td>
                    <td>Service center</td>
                    <td>{formatReadyDate(sale.saleDate)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
