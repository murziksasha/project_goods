import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { CompactPaginationPanel } from '../../../../shared/ui/PaginationPanel';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import {
  availableWarehouseColumns,
  getWarehouseColumnLabelKey,
  lockedWarehouseColumns,
  searchModes,
  type ReceiptsColumnKey,
  type StockColumnKey,
  type WarehouseColumnsTab,
  type WarehouseSearchMode,
  type WarehouseTab,
} from '../../model/warehouse-panel';
import { PrinterIcon } from '../orders/modals/PrinterIcon';

type WarehouseToolbarProps = {
  activeTab: WarehouseTab;
  currentPage: number;
  pageSize: number;
  stockSummaryText: string;
  totalItems: number;
  selectedProductCount: number;
  selectedSerialCount: number;
  activeColumnsTab: WarehouseColumnsTab | null;
  columnsMenuRef: RefObject<HTMLDivElement | null>;
  isColumnsMenuOpen: boolean;
  visibleColumnKeySet: Set<string>;
  activeFilterCount: number;
  favoritesOnly: boolean;
  query: string;
  searchMode: WarehouseSearchMode;
  searchPlaceholder: string;
  onPrintSelectedSerials: () => void;
  onClearSelection: () => void;
  onToggleColumnsMenu: () => void;
  onToggleColumnVisibility: (
    columnKey: StockColumnKey | ReceiptsColumnKey,
  ) => void;
  onToggleFilters: () => void;
  onToggleFavoritesOnly: () => void;
  setQuery: Dispatch<SetStateAction<string>>;
  setSearchMode: Dispatch<SetStateAction<WarehouseSearchMode>>;
  setCurrentPage: Dispatch<SetStateAction<number>>;
};

export const WarehouseToolbar = ({
  activeTab,
  currentPage,
  pageSize,
  stockSummaryText,
  totalItems,
  selectedProductCount,
  selectedSerialCount,
  activeColumnsTab,
  columnsMenuRef,
  isColumnsMenuOpen,
  visibleColumnKeySet,
  activeFilterCount,
  favoritesOnly,
  query,
  searchMode,
  searchPlaceholder,
  onPrintSelectedSerials,
  onClearSelection,
  onToggleColumnsMenu,
  onToggleColumnVisibility,
  onToggleFilters,
  onToggleFavoritesOnly,
  setQuery,
  setSearchMode,
  setCurrentPage,
}: WarehouseToolbarProps) => {
  const { t } = useTranslation();

  const getColumnLabel = (
    columnKey: StockColumnKey | ReceiptsColumnKey,
    tab: WarehouseColumnsTab,
  ) => {
    const tableKey = getWarehouseColumnLabelKey(columnKey, tab);
    const tableLabel = t(tableKey);
    if (tableLabel !== tableKey) return tableLabel;

    const sharedKey = `warehouse.columns.${columnKey}`;
    const sharedLabel = t(sharedKey);
    return sharedLabel !== sharedKey ? sharedLabel : columnKey;
  };

  return (
    <div className='warehouse-toolbar-shell'>
      <PageHeader
        title={t('nav.warehouse')}
        subtitle={stockSummaryText}
      />
    <div className='warehouse-toolbar'>
      <CompactPaginationPanel
        totalItems={totalItems}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />
      <span className='warehouse-stock-count'>{stockSummaryText}</span>
      {activeTab === 'stock' ? (
        <>
          <button
            type='button'
            className='toolbar-square-button order-print-icon-button warehouse-toolbar-print-button'
            aria-label={t('warehouse.toolbar.printSelectedSerialsAria')}
            title={
              selectedSerialCount > 0
                ? t('warehouse.toolbar.printSelectedCount', {
                    count: selectedSerialCount,
                  })
                : t('warehouse.toolbar.selectRowsToPrint')
            }
            onClick={onPrintSelectedSerials}
            disabled={selectedSerialCount === 0}
          >
            <PrinterIcon />
          </button>
          {selectedProductCount > 0 ? (
            <button
              type='button'
              className='toolbar-filter-button warehouse-selection-clear-button'
              onClick={onClearSelection}
            >
              {t('orders.filters.selectedCount', {
                count: selectedProductCount,
              })}
            </button>
          ) : null}
        </>
      ) : null}
      {activeColumnsTab ? (
        <div className='toolbar-settings' ref={columnsMenuRef}>
          <button
            type='button'
            className='toolbar-square-button'
            aria-label={t('warehouse.toolbar.toggleColumns')}
            aria-expanded={isColumnsMenuOpen}
            onClick={onToggleColumnsMenu}
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
              {(activeColumnsTab === 'stock'
                ? availableWarehouseColumns.stock
                : availableWarehouseColumns.receipts
              ).map((columnKey) => (
                <label
                  key={`${activeTab}-${columnKey}`}
                  className='toolbar-settings-option'
                >
                  <input
                    type='checkbox'
                    checked={visibleColumnKeySet.has(columnKey)}
                    disabled={lockedWarehouseColumns[activeColumnsTab].includes(
                      columnKey as never,
                    )}
                    onChange={() => onToggleColumnVisibility(columnKey)}
                  />
                  <span>
                    {getColumnLabel(columnKey, activeColumnsTab)}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {activeTab === 'receipts' ? (
        <button
          type='button'
          className={
            favoritesOnly
              ? 'toolbar-square-button toolbar-star-button toolbar-star-button-active'
              : 'toolbar-square-button toolbar-star-button'
          }
          aria-label={
            favoritesOnly
              ? t('warehouse.toolbar.showAllReceiptOrders')
              : t('warehouse.toolbar.showStarredReceiptOrders')
          }
          aria-pressed={favoritesOnly}
          onClick={onToggleFavoritesOnly}
        >
          <span className='supplier-order-star-icon' aria-hidden='true'>
            {favoritesOnly ? '★' : '☆'}
          </span>
        </button>
      ) : null}
      <button
        type='button'
        className='toolbar-filter-button'
        onClick={onToggleFilters}
      >
        {activeFilterCount > 0
          ? t('warehouse.toolbar.filterWithCount', {
              count: activeFilterCount,
            })
          : t('warehouse.toolbar.filter')}
      </button>
      <div className='orders-search-group warehouse-search-group'>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCurrentPage(1);
          }}
          placeholder={searchPlaceholder}
        />
        {query ? (
          <span
            role='button'
            tabIndex={0}
            className='warehouse-search-clear'
            aria-label={t('warehouse.toolbar.clearSearch')}
            onClick={() => {
              setQuery('');
              setCurrentPage(1);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setQuery('');
                setCurrentPage(1);
              }
            }}
          >
            x
          </span>
        ) : null}
      </div>
      <div className='warehouse-search-modes'>
        {searchModes.map((mode) => (
          <button
            key={mode.key}
            type='button'
            className={
              mode.key === searchMode
                ? 'warehouse-mode-button warehouse-mode-button-active'
                : 'warehouse-mode-button'
            }
            onClick={() => {
              setSearchMode(mode.key);
              setCurrentPage(1);
            }}
          >
            {t(mode.labelKey)}
          </button>
        ))}
      </div>
    </div>
    </div>
  );
};