import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { CompactPaginationPanel } from '../../../../../shared/ui/PaginationPanel';
import {
  availableColumnsByTab,
  getColumnLabel,
  getOrdersSearchPlaceholder,
  isPlainLeftClick,
  lockedColumnsByTab,
  type OrdersColumnKey,
  type OrdersTab,
} from './orders-workspace-shared';
import { OrdersWorkspaceTabList } from './OrdersWorkspaceTabList';

type OrdersWorkspaceListHeaderProps = {
  activeTab: OrdersTab;
  visibleTabs: OrdersTab[];
  permittedTabs?: OrdersTab[];
  searchValue: string;
  createOrderHref: string;
  canCreateOrders: boolean;
  filteredOrdersCount: number;
  currentPage: number;
  currentPageSize: number;
  activeFiltersCount: number;
  isFilterPanelOpen: boolean;
  isColumnsMenuOpen: boolean;
  favoritesOnly: boolean;
  visibleColumnKeys: OrdersColumnKey[];
  columnsMenuRef: RefObject<HTMLDivElement | null>;
  onActiveTabChange: (tab: OrdersTab) => void;
  onToggleTabVisibility?: (tab: OrdersTab) => void;
  onSearchChange: (value: string) => void;
  onCreateOrder: (tab: OrdersTab) => void;
  onPageChange: (page: number) => void;
  onToggleFilterPanel: () => void;
  onToggleColumnsMenu: () => void;
  onToggleColumnVisibility: (columnKey: OrdersColumnKey) => void;
  onResetColumns: () => void;
  onToggleFavoritesOnly: () => void;
  onOpenSingleMatch?: () => void;
};

export const OrdersWorkspaceListHeader = ({
  activeTab,
  visibleTabs,
  permittedTabs,
  searchValue,
  createOrderHref,
  canCreateOrders,
  filteredOrdersCount,
  currentPage,
  currentPageSize,
  activeFiltersCount,
  isFilterPanelOpen,
  isColumnsMenuOpen,
  favoritesOnly,
  visibleColumnKeys,
  columnsMenuRef,
  onActiveTabChange,
  onToggleTabVisibility,
  onSearchChange,
  onCreateOrder,
  onPageChange,
  onToggleFilterPanel,
  onToggleColumnsMenu,
  onToggleColumnVisibility,
  onResetColumns,
  onToggleFavoritesOnly,
  onOpenSingleMatch,
}: OrdersWorkspaceListHeaderProps) => {
  const { t } = useTranslation();
  const canOpenSingleMatch =
    Boolean(onOpenSingleMatch) &&
    searchValue.trim().length > 0 &&
    filteredOrdersCount === 1;
  const countLabel = t('orders.kanban.ordersCount', {
    count: filteredOrdersCount,
  });
  const countChip = canOpenSingleMatch ? (
    <button
      type="button"
      className="orders-kanban-count"
      aria-label={countLabel}
      onClick={onOpenSingleMatch}
    >
      {countLabel}
    </button>
  ) : (
    <span className="orders-kanban-count" aria-label={countLabel}>
      {countLabel}
    </span>
  );

  return (
    <>
      <OrdersWorkspaceTabList
        activeTab={activeTab}
        visibleTabs={visibleTabs}
        permittedTabs={permittedTabs}
        onActiveTabChange={onActiveTabChange}
        onToggleTabVisibility={onToggleTabVisibility}
      />

      <div className="orders-toolbar">
        <div className="orders-toolbar-left">
          {activeTab === 'kanban' ? (
            countChip
          ) : canOpenSingleMatch ? (
            countChip
          ) : (
            <CompactPaginationPanel
              totalItems={filteredOrdersCount}
              page={currentPage}
              pageSize={currentPageSize}
              onPageChange={onPageChange}
            />
          )}
          <button
            type="button"
            className="toolbar-filter-button toolbar-filter-toggle-button"
            aria-expanded={isFilterPanelOpen}
            onClick={onToggleFilterPanel}
          >
            {t('orders.toolbar.filter')}
            {activeFiltersCount > 0 ? (
              <span className="toolbar-filter-count">{activeFiltersCount}</span>
            ) : null}
          </button>
          {activeTab !== 'kanban' ? (
            <div className="toolbar-settings" ref={columnsMenuRef}>
              <button
                type="button"
                className="toolbar-square-button"
                aria-label={t('orders.toolbar.toggleColumns')}
                aria-expanded={isColumnsMenuOpen}
                onClick={onToggleColumnsMenu}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="toolbar-square-button-icon"
                  fill="currentColor"
                >
                  <path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.63.25-1.21.57-1.75.95l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.33.68.22l2.49-1c.54.38 1.12.7 1.75.95l.38 2.65c.04.27.26.47.49.47h4c.27 0 .5-.2.54-.47l.38-2.65c.63-.25 1.21-.57 1.75-.95l2.49 1c.26.11.54.02.68-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
                </svg>
              </button>
              {isColumnsMenuOpen ? (
                <div className="toolbar-settings-menu">
                  {availableColumnsByTab[activeTab].map((columnKey) => (
                    <label
                      key={`${activeTab}-${columnKey}`}
                      className="toolbar-settings-option"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumnKeys.includes(columnKey)}
                        disabled={lockedColumnsByTab[activeTab].includes(
                          columnKey,
                        )}
                        onChange={() => onToggleColumnVisibility(columnKey)}
                      />
                      <span>{getColumnLabel(columnKey, activeTab)}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="toolbar-settings-reset"
                    onClick={onResetColumns}
                  >
                    {t('orders.toolbar.resetColumns')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className={
              favoritesOnly
                ? 'toolbar-square-button toolbar-star-button toolbar-star-button-active'
                : 'toolbar-square-button toolbar-star-button'
            }
            aria-label={
              favoritesOnly
                ? activeTab === 'sales'
                  ? t('orders.toolbar.showAllSales')
                  : t('orders.toolbar.showAllOrders')
                : activeTab === 'sales'
                  ? t('orders.toolbar.showStarredSales')
                  : t('orders.toolbar.showStarredOrders')
            }
            aria-pressed={favoritesOnly}
            onClick={onToggleFavoritesOnly}
          >
            <span className="supplier-order-star-icon" aria-hidden="true">
              {favoritesOnly ? '★' : '☆'}
            </span>
          </button>
          <div className="orders-search-group orders-search-group-clearable">
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={getOrdersSearchPlaceholder(activeTab)}
              title={getOrdersSearchPlaceholder(activeTab)}
              aria-label={t('orders.toolbar.searchOrders')}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                if (!canOpenSingleMatch) return;
                event.preventDefault();
                onOpenSingleMatch?.();
              }}
            />
            {searchValue ? (
              <span
                role="button"
                tabIndex={0}
                className="orders-search-clear"
                aria-label={t('orders.toolbar.clearSearch')}
                onClick={() => onSearchChange('')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSearchChange('');
                  }
                }}
              >
                x
              </span>
            ) : null}
          </div>
        </div>
        <div className="orders-toolbar-actions">
          <a
            className={
              canCreateOrders
                ? 'orders-create-button'
                : 'orders-create-button orders-create-button-disabled'
            }
            href={canCreateOrders ? createOrderHref : '#'}
            aria-disabled={!canCreateOrders}
            tabIndex={canCreateOrders ? undefined : -1}
            onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
              if (!canCreateOrders) {
                event.preventDefault();
                return;
              }

              if (!isPlainLeftClick(event)) return;
              event.preventDefault();
              onCreateOrder(activeTab);
            }}
            title={
              canCreateOrders
                ? t('orders.toolbar.createOrder')
                : t('orders.toolbar.createOrderDenied')
            }
          >
            {t('orders.toolbar.createOrder')}
          </a>
        </div>
      </div>
    </>
  );
};