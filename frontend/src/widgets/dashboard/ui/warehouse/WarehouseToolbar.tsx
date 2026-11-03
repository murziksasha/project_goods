import type React from 'react';
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import {
  availableWarehouseColumns,
  getWarehouseColumnLabelKey,
  lockedWarehouseColumns,
  receiptStatusFilterOptions,
  searchModes,
  type ReceiptsColumnKey,
  type ReceiptsViewMode,
  type ReceiptStatus,
  type StockColumnKey,
  type StockViewMode,
  type WarehouseColumnsTab,
  type WarehouseSearchMode,
  type WarehouseTab,
} from '../../model/warehouse-panel';
import { PrinterIcon } from '../orders/modals/PrinterIcon';

export const WAREHOUSE_SEARCH_COMMIT_MS = 300;

const useCommittedSearchDraft = ({
  query,
  setQuery,
  setCurrentPage,
}: {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  setCurrentPage: Dispatch<SetStateAction<number>>;
}) => {
  const [draft, setDraft] = useState(query);
  const draftRef = useRef(query);
  const committedRef = useRef(query);
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const setQueryRef = useRef(setQuery);
  const setCurrentPageRef = useRef(setCurrentPage);

  useEffect(() => {
    setQueryRef.current = setQuery;
    setCurrentPageRef.current = setCurrentPage;
  }, [setQuery, setCurrentPage]);

  const cancelTimer = () => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const commitNow = (value: string, forcePageReset: boolean) => {
    cancelTimer();
    draftRef.current = value;
    setDraft(value);
    const changed = committedRef.current !== value;
    committedRef.current = value;
    if (changed) setQueryRef.current(value);
    if (changed || forcePageReset) setCurrentPageRef.current(1);
  };

  const onDraftChange = (value: string) => {
    draftRef.current = value;
    setDraft(value);
    cancelTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (draftRef.current !== value) return;
      if (committedRef.current === value) return;
      committedRef.current = value;
      setQueryRef.current(value);
      setCurrentPageRef.current(1);
    }, WAREHOUSE_SEARCH_COMMIT_MS);
  };

  useEffect(() => {
    // A query this toolbar just committed matches the ref. Any other value
    // came from outside, so the draft follows it.
    if (query === committedRef.current) return;
    cancelTimer();
    committedRef.current = query;
    draftRef.current = query;
    setDraft(query);
  }, [query]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const pending = draftRef.current;
      if (pending === committedRef.current) return;
      committedRef.current = pending;
      setQueryRef.current(pending);
      setCurrentPageRef.current(1);
    };
  }, []);

  const commitDraft = (forcePageReset: boolean) => {
    commitNow(draftRef.current, forcePageReset);
  };

  return { draft, onDraftChange, commitNow, commitDraft };
};

export interface WarehouseToolbarProps {
  activeTab: WarehouseTab;
  stockSummaryText: string;
  headerActions?: ReactNode;
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
  stockView: StockViewMode;
  receiptsView: ReceiptsViewMode;
  appliedReceiptStatuses: ReceiptStatus[];
  showReceiptStatusChips: boolean;
  onPrintSelectedSerials: () => void;
  onClearSelection: () => void;
  onToggleColumnsMenu: () => void;
  onToggleColumnVisibility: (
    columnKey: StockColumnKey | ReceiptsColumnKey,
  ) => void;
  onToggleFilters: () => void;
  onToggleFavoritesOnly: () => void;
  onStockViewChange: (view: StockViewMode) => void;
  onReceiptsViewChange: (view: ReceiptsViewMode) => void;
  onReceiptStatusChip: (status: ReceiptStatus | 'all') => void;
  setQuery: Dispatch<SetStateAction<string>>;
  setSearchMode: Dispatch<SetStateAction<WarehouseSearchMode>>;
  setCurrentPage: Dispatch<SetStateAction<number>>;
};

export const WarehouseToolbar: React.FC<WarehouseToolbarProps> = ({
  activeTab,
  stockSummaryText,
  headerActions,
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
  stockView,
  receiptsView,
  appliedReceiptStatuses,
  showReceiptStatusChips,
  onPrintSelectedSerials,
  onClearSelection,
  onToggleColumnsMenu,
  onToggleColumnVisibility,
  onToggleFilters,
  onToggleFavoritesOnly,
  onStockViewChange,
  onReceiptsViewChange,
  onReceiptStatusChip,
  setQuery,
  setSearchMode,
  setCurrentPage,
}) => {
  const { t } = useTranslation();
  const { draft, onDraftChange, commitNow, commitDraft } =
    useCommittedSearchDraft({
      query,
      setQuery,
      setCurrentPage,
    });

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

  const showSearchModes = activeTab !== 'receipts';
  const receiptChipValue =
    appliedReceiptStatuses.length === 1 ? appliedReceiptStatuses[0] : 'all';

  return (
    <div className='warehouse-toolbar-shell'>
      <PageHeader
        title={t('nav.warehouse')}
        subtitle={stockSummaryText}
        actions={headerActions}
      />
      <div className='warehouse-toolbar'>
        <div className='warehouse-toolbar-controls'>
          {activeTab === 'stock' ? (
            <div
              className='warehouse-view-toggle'
              role='group'
              aria-label={t('warehouse.view.ariaLabel')}
            >
              {(['models', 'units'] as const).map((view) => (
                <button
                  key={view}
                  type='button'
                  className={
                    stockView === view
                      ? 'warehouse-mode-button warehouse-mode-button-active'
                      : 'warehouse-mode-button'
                  }
                  onClick={() => onStockViewChange(view)}
                >
                  {t(`warehouse.view.${view}`)}
                </button>
              ))}
            </div>
          ) : null}
          {activeTab === 'receipts' ? (
            <div
              className='warehouse-view-toggle'
              role='group'
              aria-label={t('warehouse.view.ariaLabel')}
            >
              {(['orders', 'lines'] as const).map((view) => (
                <button
                  key={view}
                  type='button'
                  className={
                    receiptsView === view
                      ? 'warehouse-mode-button warehouse-mode-button-active'
                      : 'warehouse-mode-button'
                  }
                  onClick={() => onReceiptsViewChange(view)}
                >
                  {t(`warehouse.view.${view}`)}
                </button>
              ))}
            </div>
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
          {activeTab === 'stock' && selectedProductCount > 0 ? (
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
              <button
                type='button'
                className='toolbar-filter-button warehouse-selection-clear-button'
                onClick={onClearSelection}
              >
                {t('orders.filters.selectedCount', {
                  count: selectedProductCount,
                })}
              </button>
            </>
          ) : null}
        </div>
        <div className='warehouse-search-cluster'>
          {showSearchModes ? (
            <select
              className='warehouse-search-mode-select'
              aria-label={t('warehouse.toolbar.searchModeAria')}
              value={searchMode}
              onChange={(event) => {
                commitDraft(true);
                setSearchMode(event.target.value as WarehouseSearchMode);
              }}
            >
              {searchModes.map((mode) => (
                <option key={mode.key} value={mode.key}>
                  {t(mode.labelKey)}
                </option>
              ))}
            </select>
          ) : null}
          <div className='orders-search-group warehouse-search-group'>
            <input
              value={draft}
              onChange={(event) => {
                onDraftChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                commitDraft(true);
              }}
              placeholder={searchPlaceholder}
            />
            {draft ? (
              <span
                role='button'
                tabIndex={0}
                className='warehouse-search-clear'
                aria-label={t('warehouse.toolbar.clearSearch')}
                onClick={() => {
                  commitNow('', true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    commitNow('', true);
                  }
                }}
              >
                x
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {activeTab === 'receipts' && showReceiptStatusChips ? (
        <div className='warehouse-status-chips' role='group'>
          <button
            type='button'
            className={
              receiptChipValue === 'all'
                ? 'warehouse-mode-button warehouse-mode-button-active'
                : 'warehouse-mode-button'
            }
            onClick={() => onReceiptStatusChip('all')}
          >
            {t('warehouse.toolbar.statusAll')}
          </button>
          {receiptStatusFilterOptions.map((status) => (
            <button
              key={status}
              type='button'
              className={
                receiptChipValue === status
                  ? 'warehouse-mode-button warehouse-mode-button-active'
                  : 'warehouse-mode-button'
              }
              onClick={() => onReceiptStatusChip(status)}
            >
              {t(`warehouse.tables.receipts.status.${status}`)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
