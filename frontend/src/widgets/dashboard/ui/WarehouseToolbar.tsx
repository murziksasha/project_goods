import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  availableWarehouseColumns,
  getWarehouseColumnLabel,
  lockedWarehouseColumns,
  searchModes,
  type ReceiptsColumnKey,
  type StockColumnKey,
  type WarehouseColumnsTab,
  type WarehouseSearchMode,
  type WarehouseTab,
} from '../model/warehouse-panel';

type WarehouseToolbarProps = {
  activeTab: WarehouseTab;
  currentPage: number;
  pageCount: number;
  stockSummaryText: string;
  activeColumnsTab: WarehouseColumnsTab | null;
  columnsMenuRef: RefObject<HTMLDivElement | null>;
  isColumnsMenuOpen: boolean;
  visibleColumnKeySet: Set<string>;
  activeFilterCount: number;
  query: string;
  searchMode: WarehouseSearchMode;
  searchPlaceholder: string;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onToggleColumnsMenu: () => void;
  onToggleColumnVisibility: (
    columnKey: StockColumnKey | ReceiptsColumnKey,
  ) => void;
  onToggleFilters: () => void;
  setQuery: Dispatch<SetStateAction<string>>;
  setSearchMode: Dispatch<SetStateAction<WarehouseSearchMode>>;
  setCurrentPage: Dispatch<SetStateAction<number>>;
};

export const WarehouseToolbar = ({
  activeTab,
  currentPage,
  pageCount,
  stockSummaryText,
  activeColumnsTab,
  columnsMenuRef,
  isColumnsMenuOpen,
  visibleColumnKeySet,
  activeFilterCount,
  query,
  searchMode,
  searchPlaceholder,
  onPreviousPage,
  onNextPage,
  onToggleColumnsMenu,
  onToggleColumnVisibility,
  onToggleFilters,
  setQuery,
  setSearchMode,
  setCurrentPage,
}: WarehouseToolbarProps) => (
  <div className='warehouse-toolbar'>
    <button
      type='button'
      className='toolbar-square-button'
      aria-label='Previous page'
      onClick={onPreviousPage}
      disabled={currentPage <= 1}
    >
      &lsaquo;
    </button>
    <span className='warehouse-page-number'>{currentPage}</span>
    <button
      type='button'
      className='toolbar-square-button'
      aria-label='Next page'
      onClick={onNextPage}
      disabled={currentPage >= pageCount}
    >
      &rsaquo;
    </button>
    <span className='warehouse-stock-count'>{stockSummaryText}</span>
    {activeColumnsTab ? (
      <div className='toolbar-settings' ref={columnsMenuRef}>
        <button
          type='button'
          className='toolbar-square-button'
          aria-label='Toggle table columns'
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
                <span>{getWarehouseColumnLabel(columnKey)}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>
    ) : null}
    <button
      type='button'
      className='toolbar-filter-button'
      onClick={onToggleFilters}
    >
      {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
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
          aria-label='Clear search text'
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
          {mode.label}
        </button>
      ))}
    </div>
  </div>
);
