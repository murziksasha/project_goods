import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { CompactPaginationPanel } from '../../../../../shared/ui/PaginationPanel';
import {
  availableColumnsByTab,
  getColumnLabel,
  getOrdersSearchPlaceholder,
  isPlainLeftClick,
  lockedColumnsByTab,
  orderTabs,
  type OrdersColumnKey,
  type OrdersTab,
} from './orders-workspace-shared';

type OrdersWorkspaceListHeaderProps = {
  activeTab: OrdersTab;
  visibleTabs: OrdersTab[];
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
  onSearchChange: (value: string) => void;
  onCreateOrder: (tab: OrdersTab) => void;
  onPageChange: (page: number) => void;
  onToggleFilterPanel: () => void;
  onToggleColumnsMenu: () => void;
  onToggleColumnVisibility: (columnKey: OrdersColumnKey) => void;
  onToggleFavoritesOnly: () => void;
};

export const OrdersWorkspaceListHeader = ({
  activeTab,
  visibleTabs,
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
  onSearchChange,
  onCreateOrder,
  onPageChange,
  onToggleFilterPanel,
  onToggleColumnsMenu,
  onToggleColumnVisibility,
  onToggleFavoritesOnly,
}: OrdersWorkspaceListHeaderProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div
        className="orders-tabs"
        role="tablist"
        aria-label={t('orders.toolbar.orderCategories')}
      >
        {orderTabs
          .filter((tab) => visibleTabs.includes(tab.key))
          .map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                tab.key === activeTab
                  ? 'orders-tab orders-tab-active'
                  : 'orders-tab'
              }
              onClick={() => onActiveTabChange(tab.key)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
      </div>

      <div className="orders-toolbar">
        <div className="orders-toolbar-left">
          <CompactPaginationPanel
            totalItems={filteredOrdersCount}
            page={currentPage}
            pageSize={currentPageSize}
            onPageChange={onPageChange}
          />
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
                      disabled={lockedColumnsByTab[activeTab].includes(columnKey)}
                      onChange={() => onToggleColumnVisibility(columnKey)}
                    />
                    <span>{getColumnLabel(columnKey, activeTab)}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={
              favoritesOnly
                ? 'toolbar-square-button toolbar-star-button toolbar-star-button-active'
                : 'toolbar-square-button toolbar-star-button'
            }
            aria-label={
              favoritesOnly
                ? activeTab === 'orders'
                  ? t('orders.toolbar.showAllOrders')
                  : t('orders.toolbar.showAllSales')
                : activeTab === 'orders'
                  ? t('orders.toolbar.showStarredOrders')
                  : t('orders.toolbar.showStarredSales')
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
              aria-label={t('orders.toolbar.searchOrders')}
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