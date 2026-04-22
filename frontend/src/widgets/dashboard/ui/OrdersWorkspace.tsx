import { useMemo } from 'react';
import type { Sale } from '../../../entities/sale/model/types';

type OrdersWorkspaceProps = {
  sales: Sale[];
  isLoading: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onCreateOrder: () => void;
};

const orderTabs = ['Repairs', 'Sales', 'Supplier Orders'];

const orderStatuses = ['New repair', 'In other service', 'Ready', 'Waiting parts'] as const;

const buildOrderNumber = (sale: Sale, index: number) => {
  const numeric = Number.parseInt(sale.id.replace(/\D/g, ''), 10);
  return Number.isNaN(numeric) ? 23000 + index : numeric;
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
  onSearchChange,
  onCreateOrder,
}: OrdersWorkspaceProps) => {
  const filteredOrders = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return sales;
    }

    return sales.filter((sale, index) => {
      const orderNumber = buildOrderNumber(sale, index);
      return (
        String(orderNumber).includes(query) ||
        sale.product.name.toLowerCase().includes(query) ||
        sale.client.name.toLowerCase().includes(query) ||
        sale.client.phone.toLowerCase().includes(query)
      );
    });
  }, [sales, searchValue]);

  return (
    <section className="orders-page">
      <div className="orders-tabs" role="tablist" aria-label="Order categories">
        {orderTabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={index === 0 ? 'orders-tab orders-tab-active' : 'orders-tab'}
          >
            {tab}
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
        <button type="button" className="orders-create-button" onClick={onCreateOrder}>
          Create order
        </button>
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
                  Orders not found.
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
