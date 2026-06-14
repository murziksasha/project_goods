import type { Dispatch, RefObject, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { Supplier } from '../../../entities/supplier/model/types';
import type {
  SupplierOrder,
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from '../../../entities/supplier-order/model/types';
import { formatCurrency } from '../../../shared/lib/format';
import {
  CompactPaginationPanel,
  PaginationPanel,
} from '../../../shared/ui/PaginationPanel';
import type {
  SupplierOrderAnalytics,
  SupplierOrderProductStat,
  SupplierOrderSupplierStat,
} from '../model/supplier-order-utils';
import {
  buildGroupedSupplierOrderView,
  formatPercent,
  formatSupplierOrderDate,
  getSupplierOrderStatusClass,
  getSupplierOrderStatusLabel,
  getSupplierOrdersColumnLabel,
  getSupplierPaymentStatusClass,
  getSupplierPaymentStatusLabel,
  supplierOrderStatuses,
  supplierOrderTabs,
  supplierOrdersAllColumns,
  supplierOrdersLockedColumns,
  supplierPaymentStatuses,
  type OrdersTab,
  type SupplierOrdersColumnKey,
} from '../model/supplier-orders-workspace';

type SupplierOrdersToolbarProps = {
  activeTab: OrdersTab;
  dateFiltersCount: number;
  filteredOrdersCount: number;
  filteredOrderStatuses: typeof supplierOrderStatuses;
  filteredPaymentStatuses: typeof supplierPaymentStatuses;
  isColumnsMenuOpen: boolean;
  isFilterBarOpen: boolean;
  isInformationTab: boolean;
  isOrderStatusOpen: boolean;
  isPaymentStatusOpen: boolean;
  orderStatusFilterRef: RefObject<HTMLDivElement | null>;
  paymentStatusFilterRef: RefObject<HTMLDivElement | null>;
  columnsMenuRef: RefObject<HTMLDivElement | null>;
  paymentQuery: string;
  paymentStatus: SupplierPaymentStatus | 'all';
  page: number;
  pageSize: number;
  query: string;
  selectedStatuses: SupplierOrderStatus[];
  statusQuery: string;
  favoritesOnly: boolean;
  visibleColumns: SupplierOrdersColumnKey[];
  visibleTabs: OrdersTab[];
  canManageSupplierOrders: boolean;
  onActiveTabChange: (tab: OrdersTab) => void;
  onCreateOrder: () => void;
  onColumnsMenuOpenChange: Dispatch<SetStateAction<boolean>>;
  onFilterBarOpenChange: Dispatch<SetStateAction<boolean>>;
  onOrderStatusOpenChange: Dispatch<SetStateAction<boolean>>;
  onPaymentStatusOpenChange: Dispatch<SetStateAction<boolean>>;
  onPaymentQueryChange: (value: string) => void;
  onPaymentStatusChange: (status: SupplierPaymentStatus | 'all') => void;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onSelectedStatusesChange: Dispatch<SetStateAction<SupplierOrderStatus[]>>;
  onStatusQueryChange: (value: string) => void;
  onFavoritesOnlyChange: () => void;
  onToggleColumnVisibility: (columnKey: SupplierOrdersColumnKey) => void;
  onToggleStatus: (status: SupplierOrderStatus) => void;
};

export const SupplierOrdersToolbar = ({
  activeTab,
  dateFiltersCount,
  filteredOrdersCount,
  filteredOrderStatuses,
  filteredPaymentStatuses,
  isColumnsMenuOpen,
  isFilterBarOpen,
  isInformationTab,
  isOrderStatusOpen,
  isPaymentStatusOpen,
  orderStatusFilterRef,
  paymentStatusFilterRef,
  columnsMenuRef,
  paymentQuery,
  paymentStatus,
  page,
  pageSize,
  query,
  selectedStatuses,
  statusQuery,
  favoritesOnly,
  visibleColumns,
  visibleTabs,
  canManageSupplierOrders,
  onActiveTabChange,
  onCreateOrder,
  onColumnsMenuOpenChange,
  onFilterBarOpenChange,
  onOrderStatusOpenChange,
  onPaymentStatusOpenChange,
  onPaymentQueryChange,
  onPaymentStatusChange,
  onPageChange,
  onQueryChange,
  onSelectedStatusesChange,
  onStatusQueryChange,
  onFavoritesOnlyChange,
  onToggleColumnVisibility,
  onToggleStatus,
}: SupplierOrdersToolbarProps) => (
  <>
    <div className='orders-tabs' role='tablist' aria-label='Order categories'>
      {supplierOrderTabs.filter((tab) => visibleTabs.includes(tab.key)).map((tab) => (
        <button
          key={tab.key}
          type='button'
          className={
            tab.key === activeTab ? 'orders-tab orders-tab-active' : 'orders-tab'
          }
          onClick={() => onActiveTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>

    <div className='orders-toolbar'>
      <div className='orders-toolbar-left supplier-orders-toolbar-left'>
        {!isInformationTab ? (
          <CompactPaginationPanel
            totalItems={filteredOrdersCount}
            page={page}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        ) : null}
        <button
          type='button'
          className='toolbar-filter-button toolbar-filter-toggle-button'
          aria-expanded={isFilterBarOpen}
          onClick={() => onFilterBarOpenChange((current) => !current)}
        >
          Data
          {dateFiltersCount > 0 ? (
            <span className='toolbar-filter-count'>{dateFiltersCount}</span>
          ) : null}
        </button>

        {!isInformationTab ? (
          <div className='toolbar-settings' ref={columnsMenuRef}>
            <button
              type='button'
              className='toolbar-square-button'
              aria-label='Toggle table columns'
              aria-expanded={isColumnsMenuOpen}
              onClick={() => onColumnsMenuOpenChange((current) => !current)}
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                className='toolbar-square-button-icon'
                fill='currentColor'
              >
                <path d='M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.63.25-1.21.57-1.75.95l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.33.68.22l2.49-1c.54.38 1.12.7 1.75.95l.38 2.65c.04.27.26.47.49.47h4c.27 0 .5-.2.54-.47l.38-2.65c.63-.25 1.21-.57 1.75-.95l2.49 1c.26.11.54.02.68-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z' />
              </svg>
            </button>
            {isColumnsMenuOpen ? (
              <div className='toolbar-settings-menu'>
                {supplierOrdersAllColumns.map((columnKey) => (
                  <label key={columnKey} className='toolbar-settings-option'>
                    <input
                      type='checkbox'
                      checked={visibleColumns.includes(columnKey)}
                      disabled={supplierOrdersLockedColumns.includes(columnKey)}
                      onChange={() => onToggleColumnVisibility(columnKey)}
                    />
                    <span>{getSupplierOrdersColumnLabel(columnKey)}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {!isInformationTab ? (
          <button
            type='button'
            className={
              favoritesOnly
                ? 'toolbar-square-button toolbar-star-button toolbar-star-button-active'
                : 'toolbar-square-button toolbar-star-button'
            }
            aria-label={
              favoritesOnly
                ? 'Show all supplier orders'
                : 'Show starred supplier orders'
            }
            aria-pressed={favoritesOnly}
            onClick={onFavoritesOnlyChange}
          >
            <span className='supplier-order-star-icon' aria-hidden='true'>
              {favoritesOnly ? '★' : '☆'}
            </span>
          </button>
        ) : null}

        <div className='supplier-orders-quick-filters'>
          <div className='orders-search-group orders-search-group-clearable'>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder='Search by number, product, supplier'
            />
            {query ? (
              <span
                role='button'
                tabIndex={0}
                className='orders-search-clear'
                aria-label='Clear search text'
                onClick={() => onQueryChange('')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onQueryChange('');
                  }
                }}
              >
                x
              </span>
            ) : null}
          </div>

          <div
            className='orders-filter-field orders-filter-status-field'
            ref={orderStatusFilterRef}
          >
            <button
              type='button'
              className='orders-filter-status-toggle'
              aria-expanded={isOrderStatusOpen}
              onClick={() => onOrderStatusOpenChange((current) => !current)}
            >
              {selectedStatuses.length > 0
                ? `${selectedStatuses.length} order statuses`
                : 'Order status'}
            </button>
            {isOrderStatusOpen ? (
              <div className='orders-filter-status-menu'>
                <input
                  value={statusQuery}
                  onChange={(event) => onStatusQueryChange(event.target.value)}
                  placeholder='Search'
                />
                <label className='orders-filter-status-all'>
                  <input
                    type='checkbox'
                    checked={selectedStatuses.length === supplierOrderStatuses.length}
                    onChange={() =>
                      onSelectedStatusesChange((current) =>
                        current.length === supplierOrderStatuses.length
                          ? []
                          : supplierOrderStatuses.map((item) => item.key),
                      )
                    }
                  />
                  <span>Select all</span>
                </label>
                {filteredOrderStatuses.map((status) => (
                  <label key={status.key}>
                    <input
                      type='checkbox'
                      checked={selectedStatuses.includes(status.key)}
                      onChange={() => onToggleStatus(status.key)}
                    />
                    <span>{status.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div
            className='orders-filter-field orders-filter-status-field'
            ref={paymentStatusFilterRef}
          >
            <button
              type='button'
              className='orders-filter-status-toggle'
              aria-expanded={isPaymentStatusOpen}
              onClick={() => onPaymentStatusOpenChange((current) => !current)}
            >
              {paymentStatus === 'all'
                ? 'All payment statuses'
                : getSupplierPaymentStatusLabel(paymentStatus)}
            </button>
            {isPaymentStatusOpen ? (
              <div className='orders-filter-status-menu'>
                <input
                  value={paymentQuery}
                  onChange={(event) => onPaymentQueryChange(event.target.value)}
                  placeholder='Search'
                />
                <label>
                  <input
                    type='radio'
                    checked={paymentStatus === 'all'}
                    onChange={() => onPaymentStatusChange('all')}
                  />
                  <span>All payment statuses</span>
                </label>
                {filteredPaymentStatuses.map((status) => (
                  <label key={status.key}>
                    <input
                      type='radio'
                      checked={paymentStatus === status.key}
                      onChange={() => onPaymentStatusChange(status.key)}
                    />
                    <span>{status.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className='orders-toolbar-actions'>
        {canManageSupplierOrders ? (
          <button
            type='button'
            className='orders-create-button'
            onClick={onCreateOrder}
          >
            Order from supplier
          </button>
        ) : null}
      </div>
    </div>
  </>
);

type SupplierOrdersDateFilterPanelProps = {
  deliveryDateFrom: string;
  deliveryDateTo: string;
  isOpen: boolean;
  onDeliveryDateFromChange: (value: string) => void;
  onDeliveryDateToChange: (value: string) => void;
  onClearDates: () => void;
};

export const SupplierOrdersDateFilterPanel = ({
  deliveryDateFrom,
  deliveryDateTo,
  isOpen,
  onDeliveryDateFromChange,
  onDeliveryDateToChange,
  onClearDates,
}: SupplierOrdersDateFilterPanelProps) => (
  <section
    className={
      isOpen ? 'orders-filter-panel orders-filter-panel-open' : 'orders-filter-panel'
    }
    aria-hidden={!isOpen}
  >
    <div className='orders-filter-grid'>
      <label className='orders-filter-field supplier-orders-date-filter'>
        <span>Date from</span>
        <input
          type='date'
          value={deliveryDateFrom}
          onChange={(event) => onDeliveryDateFromChange(event.target.value)}
        />
      </label>

      <label className='orders-filter-field supplier-orders-date-filter'>
        <span>Date to</span>
        <input
          type='date'
          value={deliveryDateTo}
          onChange={(event) => onDeliveryDateToChange(event.target.value)}
        />
      </label>
    </div>

    <div className='orders-filter-actions'>
      <button type='button' className='toolbar-filter-button' onClick={onClearDates}>
        Clear dates
      </button>
    </div>
  </section>
);

const SupplierInformationMetric = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <article className='supplier-information-card'>
    <span>{label}</span>
    <strong>{value}</strong>
    {hint ? <small>{hint}</small> : null}
  </article>
);

const SupplierInformationProductList = ({
  title,
  items,
  valueLabel,
  getValue,
}: {
  title: string;
  items: SupplierOrderProductStat[];
  valueLabel: string;
  getValue: (item: SupplierOrderProductStat) => string;
}) => (
  <section className='supplier-information-panel'>
    <h2>{title}</h2>
    <div className='supplier-information-list'>
      {items.length > 0 ? (
        items.map((item) => (
          <div key={`${title}-${item.productName}`}>
            <span>{item.productName}</span>
            <strong>{getValue(item)}</strong>
            <small>
              {`${item.quantity} pcs | ${valueLabel}: ${formatCurrency(item.total)}`}
            </small>
          </div>
        ))
      ) : (
        <p className='orders-empty'>No product data.</p>
      )}
    </div>
  </section>
);

const SupplierInformationSupplierList = ({
  title,
  items,
  getValue,
}: {
  title: string;
  items: SupplierOrderSupplierStat[];
  getValue: (item: SupplierOrderSupplierStat) => string;
}) => (
  <section className='supplier-information-panel'>
    <h2>{title}</h2>
    <div className='supplier-information-list'>
      {items.length > 0 ? (
        items.map((item) => (
          <div key={`${title}-${item.supplierId}-${item.supplierName}`}>
            <span>{item.supplierName}</span>
            <strong>{getValue(item)}</strong>
            <small>{`${item.orderCount} orders | paid ${formatCurrency(item.paid)}`}</small>
          </div>
        ))
      ) : (
        <p className='orders-empty'>No supplier data.</p>
      )}
    </div>
  </section>
);

export const SupplierInformationDashboard = ({
  filteredOrdersCount,
  isLoading,
  supplierInformation,
}: {
  filteredOrdersCount: number;
  isLoading: boolean;
  supplierInformation: SupplierOrderAnalytics;
}) => (
  <section className='supplier-information-dashboard'>
    {isLoading ? <p className='orders-empty'>Loading...</p> : null}
    {!isLoading && filteredOrdersCount === 0 ? (
      <p className='orders-empty'>
        No supplier-order information for the selected filters.
      </p>
    ) : null}

    <div className='supplier-information-summary'>
      <SupplierInformationMetric
        label='Supplier orders'
        value={String(supplierInformation.orderCount)}
        hint={`${supplierInformation.totalQuantity} pcs ordered`}
      />
      <SupplierInformationMetric
        label='Total value'
        value={formatCurrency(supplierInformation.totalValue)}
        hint='Filtered procurement spend'
      />
      <SupplierInformationMetric
        label='Paid'
        value={formatCurrency(supplierInformation.paidAmount)}
        hint={`${formatPercent(supplierInformation.paymentCoveragePercent)} covered`}
      />
      <SupplierInformationMetric
        label='Outstanding'
        value={formatCurrency(supplierInformation.outstandingAmount)}
        hint='Still pending payment'
      />
      <SupplierInformationMetric
        label='Average order'
        value={formatCurrency(supplierInformation.averageOrderValue)}
        hint='Mean supplier-order value'
      />
      <SupplierInformationMetric
        label='Stocked rate'
        value={formatPercent(supplierInformation.stockedRate)}
        hint='Stocked or received orders'
      />
    </div>

    <div className='supplier-information-grid'>
      <SupplierInformationProductList
        title='Most popular goods'
        items={supplierInformation.topProductsByQuantity}
        valueLabel='value'
        getValue={(item) => `${item.quantity} pcs`}
      />
      <SupplierInformationProductList
        title='Highest purchase value'
        items={supplierInformation.topProductsByValue}
        valueLabel='value'
        getValue={(item) => formatCurrency(item.total)}
      />
      <SupplierInformationProductList
        title='Most frequent goods'
        items={supplierInformation.topProductsByFrequency}
        valueLabel='value'
        getValue={(item) => `${item.orderCount} orders`}
      />
      <section className='supplier-information-panel'>
        <h2>Price analysis</h2>
        <div className='supplier-information-price-grid'>
          <div>
            <span>Lowest price</span>
            <strong>
              {supplierInformation.lowestPricePosition
                ? formatCurrency(supplierInformation.lowestPricePosition.price)
                : '-'}
            </strong>
            <small>
              {supplierInformation.lowestPricePosition
                ? `${supplierInformation.lowestPricePosition.productName} | ${supplierInformation.lowestPricePosition.orderNumber}`
                : 'No product positions'}
            </small>
          </div>
          <div>
            <span>Highest price</span>
            <strong>
              {supplierInformation.highestPricePosition
                ? formatCurrency(supplierInformation.highestPricePosition.price)
                : '-'}
            </strong>
            <small>
              {supplierInformation.highestPricePosition
                ? `${supplierInformation.highestPricePosition.productName} | ${supplierInformation.highestPricePosition.orderNumber}`
                : 'No product positions'}
            </small>
          </div>
        </div>
        <div className='supplier-information-list'>
          {supplierInformation.productPriceRanges.length > 0 ? (
            supplierInformation.productPriceRanges.map((item) => (
              <div key={`range-${item.productName}`}>
                <span>{item.productName}</span>
                <strong>{`${formatCurrency(item.minPrice)} - ${formatCurrency(item.maxPrice)}`}</strong>
                <small>{`Avg ${formatCurrency(item.averagePrice)} | ${item.lineCount} lines`}</small>
              </div>
            ))
          ) : (
            <p className='orders-empty'>No repeated price ranges.</p>
          )}
        </div>
      </section>
      <SupplierInformationSupplierList
        title='Top suppliers by spend'
        items={supplierInformation.topSuppliersBySpend}
        getValue={(item) => formatCurrency(item.total)}
      />
      <SupplierInformationSupplierList
        title='Suppliers by pending amount'
        items={supplierInformation.topSuppliersByPending}
        getValue={(item) => formatCurrency(item.outstanding)}
      />
      <section className='supplier-information-panel supplier-information-signals'>
        <h2>Business signals</h2>
        <div className='supplier-information-signal-list'>
          <div>
            <span>Overdue orders</span>
            <strong>{supplierInformation.overdueCount}</strong>
          </div>
          <div>
            <span>Late risk in 3 days</span>
            <strong>{supplierInformation.lateRiskCount}</strong>
          </div>
          <div>
            <span>Cancelled / unavailable</span>
            <strong>
              {formatPercent(supplierInformation.cancelledUnavailableRate)}
            </strong>
          </div>
          <div>
            <span>Payment coverage</span>
            <strong>{formatPercent(supplierInformation.paymentCoveragePercent)}</strong>
          </div>
        </div>
      </section>
    </div>
  </section>
);

type SupplierOrdersTableProps = {
  catalogProducts: CatalogProduct[];
  filteredOrdersCount: number;
  isLoading: boolean;
  openStatusOrder: { key: string; order: SupplierOrder } | null;
  page: number;
  pageSize: number;
  paginatedOrders: SupplierOrder[];
  suppliers: Supplier[];
  visibleColumns: SupplierOrdersColumnKey[];
  canManageSupplierOrders: boolean;
  onError: (message: string) => void;
  onEditOrder: (order: SupplierOrder) => void;
  onOpenCatalogProduct: (product: CatalogProduct) => void;
  onOpenSupplier: (supplier: Supplier) => void;
  onToggleFavorite: (order: SupplierOrder) => void;
  onOpenStatusOrder: (
    key: string,
    order: SupplierOrder,
    rect: DOMRect,
  ) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export const SupplierOrdersTable = ({
  catalogProducts,
  filteredOrdersCount,
  isLoading,
  openStatusOrder,
  page,
  pageSize,
  paginatedOrders,
  suppliers,
  visibleColumns,
  canManageSupplierOrders,
  onError,
  onEditOrder,
  onOpenCatalogProduct,
  onOpenSupplier,
  onToggleFavorite,
  onOpenStatusOrder,
  onPageChange,
  onPageSizeChange,
}: SupplierOrdersTableProps) => (
  <>
    <div className='orders-table-wrap'>
      <table className='orders-table supplier-orders-table'>
        <thead>
          <tr>
            {visibleColumns.includes('number') ? (
              <th className='supplier-orders-col-number'>No.</th>
            ) : null}
            {visibleColumns.includes('product') ? (
              <th className='supplier-orders-col-product'>Product</th>
            ) : null}
            {visibleColumns.includes('quantity') ? (
              <th className='supplier-orders-col-quantity'>Qty</th>
            ) : null}
            {visibleColumns.includes('price') ? (
              <th className='supplier-orders-col-money'>Price</th>
            ) : null}
            {visibleColumns.includes('total') ? (
              <th className='supplier-orders-col-money'>Total</th>
            ) : null}
            {visibleColumns.includes('paid') ? (
              <th className='supplier-orders-col-money'>Paid</th>
            ) : null}
            {visibleColumns.includes('supplier') ? (
              <th className='supplier-orders-col-supplier'>Supplier</th>
            ) : null}
            {visibleColumns.includes('deliveryDate') ? (
              <th className='supplier-orders-col-date'>Delivery date</th>
            ) : null}
            {visibleColumns.includes('status') ? (
              <th className='supplier-orders-col-status'>Status</th>
            ) : null}
            {visibleColumns.includes('paymentStatus') ? (
              <th className='supplier-orders-col-payment'>Payment status</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {paginatedOrders.flatMap((order) =>
            buildGroupedSupplierOrderView(order).map(({ id, item }) => (
              <tr key={id}>
                {visibleColumns.includes('number') ? (
                  <td>
                    <div className='supplier-order-number-cell'>
                      <button
                        type='button'
                        className={
                          order.isFavorite
                            ? 'supplier-order-row-star supplier-order-row-star-active'
                            : 'supplier-order-row-star'
                        }
                        aria-label={
                          order.isFavorite
                            ? `Remove star from ${id}`
                            : `Star ${id}`
                        }
                        aria-pressed={order.isFavorite}
                        disabled={!canManageSupplierOrders}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleFavorite(order);
                        }}
                      >
                        {order.isFavorite ? '★' : '☆'}
                      </button>
                      <button
                        type='button'
                        className='catalog-name-button'
                        onClick={() => {
                          if (
                            !canManageSupplierOrders ||
                            order.paymentStatus === 'paid' ||
                            order.paymentStatus === 'without_payment'
                          ) {
                            return;
                          }
                          onEditOrder(order);
                        }}
                      >
                        {id}
                      </button>
                    </div>
                  </td>
                ) : null}
                {visibleColumns.includes('product') ? (
                  <td>
                    <button
                      type='button'
                      className='catalog-name-button'
                      onClick={() => {
                        const matchedProduct = item.catalogProductId
                          ? catalogProducts.find(
                              (product) =>
                                product.id === item.catalogProductId,
                            )
                          : catalogProducts.find(
                              (product) =>
                                product.name.trim().toLowerCase() ===
                                item.productName.trim().toLowerCase(),
                            );
                        if (!matchedProduct) {
                          onError('Product was not found in the Products catalog.');
                          return;
                        }
                        if (!canManageSupplierOrders) {
                          onError('Current employee does not have permission to manage supplier orders.');
                          return;
                        }
                        onOpenCatalogProduct(matchedProduct);
                      }}
                    >
                      {item.productName}
                    </button>
                  </td>
                ) : null}
                {visibleColumns.includes('quantity') ? (
                  <td>{item.quantity} pcs</td>
                ) : null}
                {visibleColumns.includes('price') ? (
                  <td>{formatCurrency(item.price)}</td>
                ) : null}
                {visibleColumns.includes('total') ? (
                  <td>{formatCurrency(item.quantity * item.price)}</td>
                ) : null}
                {visibleColumns.includes('paid') ? (
                  <td>{formatCurrency(order.paid)}</td>
                ) : null}
                {visibleColumns.includes('supplier') ? (
                  <td>
                    <button
                      type='button'
                      className='catalog-name-button'
                      onClick={() => {
                        const matchedSupplier = suppliers.find(
                          (supplier) => supplier.id === order.supplierId,
                        );
                        if (!matchedSupplier) {
                          onError('Supplier was not found.');
                          return;
                        }
                        if (!canManageSupplierOrders) {
                          onError('Current employee does not have permission to manage supplier orders.');
                          return;
                        }
                        onOpenSupplier(matchedSupplier);
                      }}
                    >
                      {order.supplierName}
                    </button>
                  </td>
                ) : null}
                {visibleColumns.includes('deliveryDate') ? (
                  <td>{formatSupplierOrderDate(order.deliveryDate)}</td>
                ) : null}
                {visibleColumns.includes('status') ? (
                  <td>
                    <div className='supplier-order-status-picker'>
                      <button
                        type='button'
                        className={getSupplierOrderStatusClass(order.status)}
                        disabled={
                          !canManageSupplierOrders ||
                          order.paymentStatus === 'cancelled'
                        }
                        aria-expanded={openStatusOrder?.key === id}
                        onClick={(event) =>
                          onOpenStatusOrder(
                            id,
                            order,
                            event.currentTarget.getBoundingClientRect(),
                          )
                        }
                      >
                        {getSupplierOrderStatusLabel(order.status)}
                      </button>
                    </div>
                  </td>
                ) : null}
                {visibleColumns.includes('paymentStatus') ? (
                  <td>
                    <span
                      className={getSupplierPaymentStatusClass(
                        order.paymentStatus,
                      )}
                    >
                      {getSupplierPaymentStatusLabel(order.paymentStatus)}
                    </span>
                  </td>
                ) : null}
              </tr>
            )),
          )}
        </tbody>
      </table>
      {isLoading ? <p className='orders-empty'>Loading...</p> : null}
      {!isLoading && paginatedOrders.length === 0 ? (
        <p className='orders-empty'>No supplier orders found.</p>
      ) : null}
    </div>

    <PaginationPanel
      totalItems={filteredOrdersCount}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  </>
);

export const SupplierOrderStatusMenuPortal = ({
  openStatusOrder,
  statusMenuPosition,
  onUpdateStatus,
}: {
  openStatusOrder: { key: string; order: SupplierOrder } | null;
  statusMenuPosition: { top: number; left: number } | null;
  onUpdateStatus: (order: SupplierOrder, status: SupplierOrderStatus) => void;
}) => {
  if (!openStatusOrder || !statusMenuPosition || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className='supplier-order-status-menu supplier-order-status-menu-portal'
      style={{
        top: statusMenuPosition.top,
        left: statusMenuPosition.left,
      }}
    >
      {supplierOrderStatuses.map((status) => (
        <button
          key={status.key}
          type='button'
          className={
            status.key === openStatusOrder.order.status
              ? 'supplier-order-status-option supplier-order-status-option-active'
              : 'supplier-order-status-option'
          }
          onClick={() => onUpdateStatus(openStatusOrder.order, status.key)}
        >
          {status.label}
        </button>
      ))}
    </div>,
    document.body,
  );
};

export const SupplierEditModal = ({
  form,
  isSaving,
  onClose,
  onFormChange,
  onSave,
}: {
  form: { name: string; phone: string; note: string; isActive: boolean };
  isSaving: boolean;
  onClose: () => void;
  onFormChange: Dispatch<
    SetStateAction<{ name: string; phone: string; note: string; isActive: boolean }>
  >;
  onSave: () => void;
}) => (
  <div
    className='modal-backdrop'
    role='presentation'
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
      <header className='catalog-edit-header'>
        <div className='catalog-edit-title'>
          <h2>Supplier</h2>
        </div>
        <button
          type='button'
          className='create-order-close'
          onClick={onClose}
          aria-label='Close'
        >
          &times;
        </button>
      </header>
      <div className='catalog-edit-body'>
        <label className='field'>
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
        </label>
        <label className='field'>
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
          />
        </label>
        <label className='field field-wide'>
          <span>Note</span>
          <textarea
            rows={3}
            value={form.note}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <footer className='catalog-edit-footer'>
        <button
          type='button'
          className='primary-button'
          disabled={
            isSaving || form.name.trim().length < 2 || form.phone.trim().length < 3
          }
          onClick={onSave}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </footer>
    </section>
  </div>
);

export const CatalogProductEditModal = ({
  form,
  isSaving,
  onClose,
  onFormChange,
  onSave,
}: {
  form: { name: string; note: string; isActive: boolean };
  isSaving: boolean;
  onClose: () => void;
  onFormChange: Dispatch<SetStateAction<{ name: string; note: string; isActive: boolean }>>;
  onSave: () => void;
}) => (
  <div
    className='modal-backdrop'
    role='presentation'
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
      <header className='catalog-edit-header'>
        <div className='catalog-edit-title'>
          <h2>Product</h2>
        </div>
        <button
          type='button'
          className='create-order-close'
          onClick={onClose}
          aria-label='Close'
        >
          &times;
        </button>
      </header>
      <div className='catalog-edit-body'>
        <label className='field'>
          <span>Product name</span>
          <input
            value={form.name}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
        </label>
        <label className='field field-wide'>
          <span>Note</span>
          <textarea
            rows={3}
            value={form.note}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <footer className='catalog-edit-footer'>
        <button
          type='button'
          className='primary-button'
          disabled={isSaving || form.name.trim().length < 2}
          onClick={onSave}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </footer>
    </section>
  </div>
);
