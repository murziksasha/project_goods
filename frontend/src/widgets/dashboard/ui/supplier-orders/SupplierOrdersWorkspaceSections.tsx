import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { CatalogProduct } from '../../../../entities/catalog-product/model/types';
import type { Supplier } from '../../../../entities/supplier/model/types';
import type {
  SupplierOrder,
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from '../../../../entities/supplier-order/model/types';
import { formatCurrency } from '../../../../shared/lib/format';
import {
  CompactPaginationPanel,
  PaginationPanel,
} from '../../../../shared/ui/PaginationPanel';
import type {
  SupplierOrderAnalytics,
  SupplierOrderProductStat,
  SupplierOrderSupplierStat,
} from '../../model/supplier-order-utils';
import { buildSupplierOrderItemNumber } from '../../model/supplier-order-utils';
import {
  buildGroupedSupplierOrderView,
  formatPercent,
  formatSupplierOrderDate,
  getSupplierOrderStatusClass,
  getSupplierOrderStatusLabel,
  getSupplierPaymentStatusClass,
  getSupplierPaymentStatusLabel,
  manualSupplierOrderStatuses,
  supplierOrderStatuses,
  supplierOrderTabs,
  supplierOrdersAllColumns,
  supplierOrdersLockedColumns,
  supplierPaymentStatuses,
  type OrdersTab,
  type SupplierOrdersColumnKey,
} from '../../model/supplier-orders-workspace';

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
}: SupplierOrdersToolbarProps) => {
  const { t } = useTranslation();

  return (
  <>
    <div className='orders-tabs' role='tablist' aria-label={t('orders.toolbar.orderCategories')}>
      {supplierOrderTabs.filter((tab) => visibleTabs.includes(tab.key)).map((tab) => (
        <button
          key={tab.key}
          type='button'
          className={
            tab.key === activeTab ? 'orders-tab orders-tab-active' : 'orders-tab'
          }
          onClick={() => onActiveTabChange(tab.key)}
        >
          {t(`orders.tabs.${tab.key}`)}
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
          {t('orders.supplier.toolbar.data')}
          {dateFiltersCount > 0 ? (
            <span className='toolbar-filter-count'>{dateFiltersCount}</span>
          ) : null}
        </button>

        {!isInformationTab ? (
          <div className='toolbar-settings' ref={columnsMenuRef}>
            <button
              type='button'
              className='toolbar-square-button'
              aria-label={t('orders.toolbar.toggleColumns')}
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
                    <span>{t(`orders.supplier.columns.${columnKey}`)}</span>
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
                ? t('orders.supplier.toolbar.showAllOrders')
                : t('orders.supplier.toolbar.showStarredOrders')
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
              placeholder={t('orders.supplier.toolbar.searchPlaceholder')}
            />
            {query ? (
              <span
                role='button'
                tabIndex={0}
                className='orders-search-clear'
                aria-label={t('orders.toolbar.clearSearch')}
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
                ? t('orders.supplier.toolbar.orderStatusesCount', {
                    count: selectedStatuses.length,
                  })
                : t('orders.supplier.toolbar.orderStatus')}
            </button>
            {isOrderStatusOpen ? (
              <div className='orders-filter-status-menu'>
                <input
                  value={statusQuery}
                  onChange={(event) => onStatusQueryChange(event.target.value)}
                  placeholder={t('orders.supplier.toolbar.search')}
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
                  <span>{t('orders.supplier.toolbar.selectAll')}</span>
                </label>
                {filteredOrderStatuses.map((status) => (
                  <label key={status.key}>
                    <input
                      type='checkbox'
                      checked={selectedStatuses.includes(status.key)}
                      onChange={() => onToggleStatus(status.key)}
                    />
                    <span>{t(status.labelKey)}</span>
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
                ? t('orders.supplier.toolbar.allPaymentStatuses')
                : getSupplierPaymentStatusLabel(paymentStatus)}
            </button>
            {isPaymentStatusOpen ? (
              <div className='orders-filter-status-menu'>
                <input
                  value={paymentQuery}
                  onChange={(event) => onPaymentQueryChange(event.target.value)}
                  placeholder={t('orders.supplier.toolbar.search')}
                />
                <label>
                  <input
                    type='radio'
                    checked={paymentStatus === 'all'}
                    onChange={() => onPaymentStatusChange('all')}
                  />
                  <span>{t('orders.supplier.toolbar.allPaymentStatuses')}</span>
                </label>
                {filteredPaymentStatuses.map((status) => (
                  <label key={status.key}>
                    <input
                      type='radio'
                      checked={paymentStatus === status.key}
                      onChange={() => onPaymentStatusChange(status.key)}
                    />
                    <span>{t(status.labelKey)}</span>
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
            {t('orders.supplier.toolbar.createOrder')}
          </button>
        ) : null}
      </div>
    </div>
  </>
  );
};

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
}: SupplierOrdersDateFilterPanelProps) => {
  const { t } = useTranslation();

  return (
  <section
    className={
      isOpen ? 'orders-filter-panel orders-filter-panel-open' : 'orders-filter-panel'
    }
    aria-hidden={!isOpen}
  >
    <div className='orders-filter-grid'>
      <label className='orders-filter-field supplier-orders-date-filter'>
        <span>{t('orders.supplier.filters.dateFrom')}</span>
        <input
          type='date'
          value={deliveryDateFrom}
          onChange={(event) => onDeliveryDateFromChange(event.target.value)}
        />
      </label>

      <label className='orders-filter-field supplier-orders-date-filter'>
        <span>{t('orders.supplier.filters.dateTo')}</span>
        <input
          type='date'
          value={deliveryDateTo}
          onChange={(event) => onDeliveryDateToChange(event.target.value)}
        />
      </label>
    </div>

    <div className='orders-filter-actions'>
      <button type='button' className='toolbar-filter-button' onClick={onClearDates}>
        {t('orders.supplier.filters.clearDates')}
      </button>
    </div>
  </section>
  );
};

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
}) => {
  const { t } = useTranslation();

  return (
  <section className='supplier-information-panel'>
    <h2>{title}</h2>
    <div className='supplier-information-list'>
      {items.length > 0 ? (
        items.map((item) => (
          <div key={`${title}-${item.productName}`}>
            <span>{item.productName}</span>
            <strong>{getValue(item)}</strong>
            <small>
              {`${t('orders.supplier.information.quantityPcs', { count: item.quantity })} | ${valueLabel}: ${formatCurrency(item.total)}`}
            </small>
          </div>
        ))
      ) : (
        <p className='orders-empty'>{t('orders.supplier.information.noProductData')}</p>
      )}
    </div>
  </section>
  );
};

const SupplierInformationSupplierList = ({
  title,
  items,
  getValue,
}: {
  title: string;
  items: SupplierOrderSupplierStat[];
  getValue: (item: SupplierOrderSupplierStat) => string;
}) => {
  const { t } = useTranslation();

  return (
  <section className='supplier-information-panel'>
    <h2>{title}</h2>
    <div className='supplier-information-list'>
      {items.length > 0 ? (
        items.map((item) => (
          <div key={`${title}-${item.supplierId}-${item.supplierName}`}>
            <span>{item.supplierName}</span>
            <strong>{getValue(item)}</strong>
            <small>
              {t('orders.supplier.information.ordersPaid', {
                count: item.orderCount,
                amount: formatCurrency(item.paid),
              })}
            </small>
          </div>
        ))
      ) : (
        <p className='orders-empty'>{t('orders.supplier.information.noSupplierData')}</p>
      )}
    </div>
  </section>
  );
};

export const SupplierInformationDashboard = ({
  filteredOrdersCount,
  isLoading,
  supplierInformation,
}: {
  filteredOrdersCount: number;
  isLoading: boolean;
  supplierInformation: SupplierOrderAnalytics;
}) => {
  const { t } = useTranslation();

  return (
  <section className='supplier-information-dashboard'>
    {isLoading ? <p className='orders-empty'>{t('orders.supplier.information.loading')}</p> : null}
    {!isLoading && filteredOrdersCount === 0 ? (
      <p className='orders-empty'>
        {t('orders.supplier.information.empty')}
      </p>
    ) : null}

    <div className='supplier-information-summary'>
      <SupplierInformationMetric
        label={t('orders.supplier.information.supplierOrders')}
        value={String(supplierInformation.orderCount)}
        hint={t('orders.supplier.information.pcsOrdered', {
          count: supplierInformation.totalQuantity,
        })}
      />
      <SupplierInformationMetric
        label={t('orders.supplier.information.totalValue')}
        value={formatCurrency(supplierInformation.totalValue)}
        hint={t('orders.supplier.information.filteredSpend')}
      />
      <SupplierInformationMetric
        label={t('orders.supplier.information.paid')}
        value={formatCurrency(supplierInformation.paidAmount)}
        hint={t('orders.supplier.information.covered', {
          percent: formatPercent(supplierInformation.paymentCoveragePercent),
        })}
      />
      <SupplierInformationMetric
        label={t('orders.supplier.information.outstanding')}
        value={formatCurrency(supplierInformation.outstandingAmount)}
        hint={t('orders.supplier.information.pendingPayment')}
      />
      <SupplierInformationMetric
        label={t('orders.supplier.information.averageOrder')}
        value={formatCurrency(supplierInformation.averageOrderValue)}
        hint={t('orders.supplier.information.meanValue')}
      />
      <SupplierInformationMetric
        label={t('orders.supplier.information.stockedRate')}
        value={formatPercent(supplierInformation.stockedRate)}
        hint={t('orders.supplier.information.stockedHint')}
      />
    </div>

    <div className='supplier-information-grid'>
      <SupplierInformationProductList
        title={t('orders.supplier.information.mostPopularGoods')}
        items={supplierInformation.topProductsByQuantity}
        valueLabel={t('orders.supplier.information.valueLabel')}
        getValue={(item) =>
          t('orders.supplier.information.quantityPcs', { count: item.quantity })
        }
      />
      <SupplierInformationProductList
        title={t('orders.supplier.information.highestPurchaseValue')}
        items={supplierInformation.topProductsByValue}
        valueLabel={t('orders.supplier.information.valueLabel')}
        getValue={(item) => formatCurrency(item.total)}
      />
      <SupplierInformationProductList
        title={t('orders.supplier.information.mostFrequentGoods')}
        items={supplierInformation.topProductsByFrequency}
        valueLabel={t('orders.supplier.information.valueLabel')}
        getValue={(item) =>
          t('orders.supplier.information.orderCount', { count: item.orderCount })
        }
      />
      <section className='supplier-information-panel'>
        <h2>{t('orders.supplier.information.priceAnalysis')}</h2>
        <div className='supplier-information-price-grid'>
          <div>
            <span>{t('orders.supplier.information.lowestPrice')}</span>
            <strong>
              {supplierInformation.lowestPricePosition
                ? formatCurrency(supplierInformation.lowestPricePosition.price)
                : '-'}
            </strong>
            <small>
              {supplierInformation.lowestPricePosition
                ? `${supplierInformation.lowestPricePosition.productName} | ${supplierInformation.lowestPricePosition.orderNumber}`
                : t('orders.supplier.information.noProductPositions')}
            </small>
          </div>
          <div>
            <span>{t('orders.supplier.information.highestPrice')}</span>
            <strong>
              {supplierInformation.highestPricePosition
                ? formatCurrency(supplierInformation.highestPricePosition.price)
                : '-'}
            </strong>
            <small>
              {supplierInformation.highestPricePosition
                ? `${supplierInformation.highestPricePosition.productName} | ${supplierInformation.highestPricePosition.orderNumber}`
                : t('orders.supplier.information.noProductPositions')}
            </small>
          </div>
        </div>
        <div className='supplier-information-list'>
          {supplierInformation.productPriceRanges.length > 0 ? (
            supplierInformation.productPriceRanges.map((item) => (
              <div key={`range-${item.productName}`}>
                <span>{item.productName}</span>
                <strong>
                  {t('orders.supplier.information.priceRange', {
                    min: formatCurrency(item.minPrice),
                    max: formatCurrency(item.maxPrice),
                  })}
                </strong>
                <small>
                  {t('orders.supplier.information.avgLines', {
                    amount: formatCurrency(item.averagePrice),
                    count: item.lineCount,
                  })}
                </small>
              </div>
            ))
          ) : (
            <p className='orders-empty'>{t('orders.supplier.information.noRepeatedRanges')}</p>
          )}
        </div>
      </section>
      <SupplierInformationSupplierList
        title={t('orders.supplier.information.topSuppliersBySpend')}
        items={supplierInformation.topSuppliersBySpend}
        getValue={(item) => formatCurrency(item.total)}
      />
      <SupplierInformationSupplierList
        title={t('orders.supplier.information.suppliersByPending')}
        items={supplierInformation.topSuppliersByPending}
        getValue={(item) => formatCurrency(item.outstanding)}
      />
      <section className='supplier-information-panel supplier-information-signals'>
        <h2>{t('orders.supplier.information.businessSignals')}</h2>
        <div className='supplier-information-signal-list'>
          <div>
            <span>{t('orders.supplier.information.overdueOrders')}</span>
            <strong>{supplierInformation.overdueCount}</strong>
          </div>
          <div>
            <span>{t('orders.supplier.information.lateRiskIn3Days')}</span>
            <strong>{supplierInformation.lateRiskCount}</strong>
          </div>
          <div>
            <span>{t('orders.supplier.information.cancelledUnavailable')}</span>
            <strong>
              {formatPercent(supplierInformation.cancelledUnavailableRate)}
            </strong>
          </div>
          <div>
            <span>{t('orders.supplier.information.paymentCoverage')}</span>
            <strong>{formatPercent(supplierInformation.paymentCoveragePercent)}</strong>
          </div>
        </div>
      </section>
    </div>
  </section>
  );
};

type SupplierOrdersTableProps = {
  catalogProducts: CatalogProduct[];
  filteredOrdersCount: number;
  isLoading: boolean;
  openStatusOrder: { key: string; order: SupplierOrder } | null;
  page: number;
  pageSize: number;
  paginatedOrders: SupplierOrder[];
  suppliers: Supplier[];
  tableWrapRef?: RefObject<HTMLDivElement | null>;
  visibleColumns: SupplierOrdersColumnKey[];
  canViewSupplierOrders: boolean;
  canManageSupplierOrders: boolean;
  onError: (message: string) => void;
  onEditOrder: (
    order: SupplierOrder,
    sourceOrder: SupplierOrder,
    itemIndex: number,
  ) => void;
  onOpenCatalogProduct: (product: CatalogProduct) => void;
  onOpenSupplier: (supplier: Supplier) => void;
  onToggleFavorite: (order: SupplierOrder) => void;
  onOpenStatusOrder: (
    key: string,
    order: SupplierOrder,
    itemIndex: number,
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
  tableWrapRef,
  visibleColumns,
  canViewSupplierOrders,
  canManageSupplierOrders,
  onError,
  onEditOrder,
  onOpenCatalogProduct,
  onOpenSupplier,
  onToggleFavorite,
  onOpenStatusOrder,
  onPageChange,
  onPageSizeChange,
}: SupplierOrdersTableProps) => {
  const { t } = useTranslation();

  return (
  <>
    <div className='orders-table-wrap' ref={tableWrapRef}>
      <table className='orders-table supplier-orders-table'>
        <thead>
          <tr>
            {visibleColumns.includes('number') ? (
              <th className='supplier-orders-col-number'>{t('orders.supplier.columns.number')}</th>
            ) : null}
            {visibleColumns.includes('product') ? (
              <th className='supplier-orders-col-product'>{t('orders.supplier.columns.product')}</th>
            ) : null}
            {visibleColumns.includes('quantity') ? (
              <th className='supplier-orders-col-quantity'>{t('orders.supplier.columns.quantity')}</th>
            ) : null}
            {visibleColumns.includes('price') ? (
              <th className='supplier-orders-col-money'>{t('orders.supplier.columns.price')}</th>
            ) : null}
            {visibleColumns.includes('total') ? (
              <th className='supplier-orders-col-money'>{t('orders.supplier.columns.total')}</th>
            ) : null}
            {visibleColumns.includes('paid') ? (
              <th className='supplier-orders-col-money'>{t('orders.supplier.columns.paid')}</th>
            ) : null}
            {visibleColumns.includes('supplier') ? (
              <th className='supplier-orders-col-supplier'>{t('orders.supplier.columns.supplier')}</th>
            ) : null}
            {visibleColumns.includes('deliveryDate') ? (
              <th className='supplier-orders-col-date'>{t('orders.supplier.columns.deliveryDate')}</th>
            ) : null}
            {visibleColumns.includes('status') ? (
              <th className='supplier-orders-col-status'>{t('orders.supplier.columns.status')}</th>
            ) : null}
            {visibleColumns.includes('paymentStatus') ? (
              <th className='supplier-orders-col-payment'>{t('orders.supplier.columns.paymentStatus')}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {paginatedOrders.flatMap((order) =>
            buildGroupedSupplierOrderView(order).map(({ id, item }) => (
              <tr key={id}>
                {visibleColumns.includes('number') ? (
                  <td
                    className='supplier-orders-number-cell'
                    data-label={t('orders.supplier.columns.number')}
                  >
                    <div className='supplier-order-number-cell'>
                      <button
                        type='button'
                        className={
                          order.isFavorite === true
                            ? 'supplier-order-row-star supplier-order-row-star-active'
                            : 'supplier-order-row-star'
                        }
                        aria-label={
                          order.isFavorite === true
                            ? t('orders.supplier.table.unstarOrder', { id })
                            : t('orders.supplier.table.starOrder', { id })
                        }
                        aria-pressed={order.isFavorite === true}
                        disabled={!canManageSupplierOrders}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleFavorite(order);
                        }}
                      >
                        {order.isFavorite === true ? '★' : '☆'}
                      </button>
                      <button
                        type='button'
                        className='supplier-order-number-button'
                        onClick={() => {
                          if (!canViewSupplierOrders) {
                            onError(t('orders.supplier.messages.errors.noViewPermission'));
                            return;
                          }
                          onEditOrder(
                            {
                              ...order,
                              receiptStatus: item.receiptStatus ?? 'new',
                              number: buildSupplierOrderItemNumber(
                                order,
                                item.itemIndex,
                              ),
                              items: [item],
                            },
                            order,
                            item.itemIndex,
                          );
                        }}
                      >
                        {id}
                      </button>
                    </div>
                  </td>
                ) : null}
                {visibleColumns.includes('product') ? (
                  <td data-label={t('orders.supplier.columns.product')}>
                    <button
                      type='button'
                      className={`catalog-name-button${
                        item.receiptStatus === 'cancelled'
                          ? ' supplier-order-item-cancelled'
                          : ''
                      }`}
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
                          onError(t('orders.supplier.messages.errors.productNotFound'));
                          return;
                        }
                        if (!canManageSupplierOrders) {
                          onError(t('orders.supplier.messages.errors.noManagePermission'));
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
                  <td data-label={t('orders.supplier.columns.quantity')}>
                    {item.quantity} {t('orders.supplier.table.pcs')}
                  </td>
                ) : null}
                {visibleColumns.includes('price') ? (
                  <td data-label={t('orders.supplier.columns.price')}>{formatCurrency(item.price)}</td>
                ) : null}
                {visibleColumns.includes('total') ? (
                  <td data-label={t('orders.supplier.columns.total')}>{formatCurrency(item.quantity * item.price)}</td>
                ) : null}
                {visibleColumns.includes('paid') ? (
                  <td data-label={t('orders.supplier.columns.paid')}>{formatCurrency(order.paid)}</td>
                ) : null}
                {visibleColumns.includes('supplier') ? (
                  <td data-label={t('orders.supplier.columns.supplier')}>
                    <button
                      type='button'
                      className='catalog-name-button'
                      onClick={() => {
                        const matchedSupplier = suppliers.find(
                          (supplier) => supplier.id === order.supplierId,
                        );
                        if (!matchedSupplier) {
                          onError(t('orders.supplier.messages.errors.supplierNotFound'));
                          return;
                        }
                        if (!canManageSupplierOrders) {
                          onError(t('orders.supplier.messages.errors.noManagePermission'));
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
                  <td data-label={t('orders.supplier.columns.deliveryDate')}>{formatSupplierOrderDate(order.deliveryDate)}</td>
                ) : null}
                {visibleColumns.includes('status') ? (
                  <td data-label={t('orders.supplier.columns.status')}>
                    <div className='supplier-order-status-picker'>
                      <button
                        type='button'
                        className={getSupplierOrderStatusClass(order.status)}
                        data-supplier-order-status-trigger={id}
                        disabled={
                          !canManageSupplierOrders ||
                          order.paymentStatus === 'cancelled' ||
                          order.status === 'cancelled' ||
                          order.status === 'unavailable'
                        }
                        aria-expanded={openStatusOrder?.key === id}
                        aria-haspopup='listbox'
                        onClick={(event) =>
                          onOpenStatusOrder(
                            id,
                            order,
                            item.itemIndex,
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
                  <td data-label={t('orders.supplier.columns.paymentStatus')}>
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
      {isLoading ? <p className='orders-empty'>{t('orders.supplier.table.loading')}</p> : null}
      {!isLoading && paginatedOrders.length === 0 ? (
        <p className='orders-empty'>{t('orders.supplier.table.empty')}</p>
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
};

export const SupplierOrderStatusMenuPortal = ({
  openStatusOrder,
  statusMenuPosition,
  onUpdateStatus,
}: {
  openStatusOrder: { key: string; order: SupplierOrder } | null;
  statusMenuPosition: {
    top: number;
    left: number;
    maxHeight: number;
    placement: 'below' | 'above';
  } | null;
  onUpdateStatus: (order: SupplierOrder, status: SupplierOrderStatus) => void;
}) => {
  const { t } = useTranslation();
  const optionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const options = optionsRef.current;
    if (!options) return;

    const handleWheel = (event: WheelEvent) => {
      event.stopPropagation();
      const { scrollTop, scrollHeight, clientHeight } = options;
      if (scrollHeight <= clientHeight) {
        event.preventDefault();
        return;
      }

      const deltaY = event.deltaY;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((deltaY > 0 && atBottom) || (deltaY < 0 && atTop)) {
        event.preventDefault();
      }
    };

    options.addEventListener('wheel', handleWheel, { passive: false });
    return () => options.removeEventListener('wheel', handleWheel);
  }, [openStatusOrder, statusMenuPosition]);

  if (!openStatusOrder || !statusMenuPosition || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={`supplier-order-status-menu supplier-order-status-menu-portal supplier-order-status-menu-portal-${statusMenuPosition.placement}`}
      style={{
        top: statusMenuPosition.top,
        left: statusMenuPosition.left,
        maxHeight: statusMenuPosition.maxHeight,
      }}
    >
      <div className='supplier-order-status-menu-header'>
        {t('orders.supplier.statusMenu.orderLabel', { id: openStatusOrder.key })}
      </div>
      <div
        ref={optionsRef}
        className='supplier-order-status-menu-options'
        role='listbox'
        aria-label={t('orders.supplier.statusMenu.orderLabel', {
          id: openStatusOrder.key,
        })}
      >
        {manualSupplierOrderStatuses.map((status) => (
          <button
            key={status.key}
            type='button'
            role='option'
            aria-selected={status.key === openStatusOrder.order.status}
            className={
              status.key === openStatusOrder.order.status
                ? 'supplier-order-status-option supplier-order-status-option-active'
                : 'supplier-order-status-option'
            }
            onClick={() => onUpdateStatus(openStatusOrder.order, status.key)}
          >
            {t(status.labelKey)}
          </button>
        ))}
      </div>
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
}) => {
  const { t } = useTranslation();

  return (
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
          <h2>{t('orders.supplier.editModal.supplier')}</h2>
        </div>
        <button
          type='button'
          className='create-order-close'
          onClick={onClose}
          aria-label={t('common.close')}
        >
          &times;
        </button>
      </header>
      <div className='catalog-edit-body'>
        <label className='field'>
          <span>{t('common.name')}</span>
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
          <span>{t('orders.supplier.editModal.phone')}</span>
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
          <span>{t('orders.supplier.editModal.note')}</span>
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
          {isSaving ? t('orders.supplier.editModal.saving') : t('common.save')}
        </button>
      </footer>
    </section>
  </div>
  );
};

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
}) => {
  const { t } = useTranslation();

  return (
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
          <h2>{t('orders.supplier.editModal.product')}</h2>
        </div>
        <button
          type='button'
          className='create-order-close'
          onClick={onClose}
          aria-label={t('common.close')}
        >
          &times;
        </button>
      </header>
      <div className='catalog-edit-body'>
        <label className='field'>
          <span>{t('orders.supplier.editModal.productName')}</span>
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
          <span>{t('orders.supplier.editModal.note')}</span>
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
          {isSaving ? t('orders.supplier.editModal.saving') : t('common.save')}
        </button>
      </footer>
    </section>
  </div>
  );
};
