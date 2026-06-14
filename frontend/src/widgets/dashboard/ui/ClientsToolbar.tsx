import { CompactPaginationPanel } from '../../../shared/ui/PaginationPanel';

type ClientsToolbarProps = {
  activeFiltersCount: number;
  filteredClientsCount: number;
  isFilterOpen: boolean;
  page: number;
  pageSize: number;
  searchValue: string;
  onPageChange: (page: number) => void;
  onToggleFilters: () => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onOpenCreateModal: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenMergeModal: () => void;
  isExporting: boolean;
  isImporting: boolean;
  isBusy: boolean;
};

export const ClientsToolbar = ({
  activeFiltersCount,
  filteredClientsCount,
  isFilterOpen,
  page,
  pageSize,
  searchValue,
  onPageChange,
  onToggleFilters,
  onSearchChange,
  onClearSearch,
  onOpenCreateModal,
  onOpenExport,
  onOpenImport,
  onOpenMergeModal,
  isExporting,
  isImporting,
  isBusy,
}: ClientsToolbarProps) => (
  <div className='orders-toolbar clients-toolbar'>
    <div className='orders-toolbar-left'>
      <CompactPaginationPanel
        totalItems={filteredClientsCount}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
      <button
        type='button'
        className='toolbar-filter-button toolbar-filter-toggle-button'
        aria-expanded={isFilterOpen}
        onClick={onToggleFilters}
      >
        Filter
        {activeFiltersCount > 0 ? (
          <span className='toolbar-filter-count'>
            {activeFiltersCount}
          </span>
        ) : null}
      </button>
      <div className='orders-search-group orders-search-group-clearable clients-search-group'>
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder='Search by name or phone'
          aria-label='Search client'
        />
        {searchValue ? (
          <span
            role='button'
            tabIndex={0}
            className='orders-search-clear'
            aria-label='Clear search text'
            onClick={onClearSearch}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClearSearch();
              }
            }}
          >
            x
          </span>
        ) : null}
      </div>
    </div>
    <div className='orders-toolbar-actions clients-toolbar-actions'>
      <button
        type='button'
        className='clients-import-button'
        onClick={onOpenImport}
        disabled={isBusy || isImporting || isExporting}
      >
        {isImporting ? 'Importing...' : 'Import XLS'}
      </button>
      <button
        type='button'
        className='clients-export-button'
        onClick={onOpenExport}
        disabled={isBusy || isImporting || isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export XLS'}
      </button>
      <button
        type='button'
        className='toolbar-filter-button'
        onClick={onOpenMergeModal}
        disabled={isBusy || isImporting}
      >
        Merge
      </button>
      <button
        type='button'
        className='orders-create-button'
        onClick={onOpenCreateModal}
        disabled={isBusy || isImporting}
      >
        Create client
      </button>
    </div>
  </div>
);
