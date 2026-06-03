type ClientsToolbarProps = {
  activeFiltersCount: number;
  isFilterOpen: boolean;
  searchValue: string;
  onToggleFilters: () => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onOpenCreateModal: () => void;
  onOpenMergeModal: () => void;
};

export const ClientsToolbar = ({
  activeFiltersCount,
  isFilterOpen,
  searchValue,
  onToggleFilters,
  onSearchChange,
  onClearSearch,
  onOpenCreateModal,
  onOpenMergeModal,
}: ClientsToolbarProps) => (
  <div className='orders-toolbar clients-toolbar'>
    <div className='orders-toolbar-left'>
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
        className='toolbar-filter-button'
        onClick={onOpenMergeModal}
      >
        Merge
      </button>
      <button
        type='button'
        className='orders-create-button'
        onClick={onOpenCreateModal}
      >
        Create client
      </button>
    </div>
  </div>
);
