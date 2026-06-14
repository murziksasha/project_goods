import type { ClientStatus } from '../../../entities/client/model/types';
import { getClientStatusColor } from '../../../entities/client/model/constants';
import type { ClientFilters } from '../model/clients-workspace';
import { SavedFiltersPanel } from './SavedFiltersPanel';

type ClientStatusOption = {
  label: string;
  value: ClientStatus | '' | 'all';
};

type ClientsFilterPanelProps = {
  draftFilters: ClientFilters;
  isOpen: boolean;
  statusOptions: ClientStatusOption[];
  savedFilters: Array<{ id: string; name: string; icon: string }>;
  canSaveFilter: boolean;
  newFilterIcon: string;
  newFilterName: string;
  onApply: () => void;
  onApplySavedFilter: (id: string) => void;
  onChange: (filters: ClientFilters) => void;
  onClear: () => void;
  onDeleteSavedFilter: (id: string) => void;
  onFilterIconChange: (icon: string) => void;
  onFilterNameChange: (name: string) => void;
  onSaveFilter: () => void;
};

export const ClientsFilterPanel = ({
  draftFilters,
  isOpen,
  statusOptions,
  savedFilters,
  canSaveFilter,
  newFilterIcon,
  newFilterName,
  onApply,
  onApplySavedFilter,
  onChange,
  onClear,
  onDeleteSavedFilter,
  onFilterIconChange,
  onFilterNameChange,
  onSaveFilter,
}: ClientsFilterPanelProps) => {
  const updateFilter = <K extends keyof ClientFilters>(
    field: K,
    value: ClientFilters[K],
  ) => onChange({ ...draftFilters, [field]: value });

  return (
    <section
      className={
        isOpen
          ? 'orders-filter-panel orders-filter-panel-open'
          : 'orders-filter-panel'
      }
    >
      <SavedFiltersPanel
        canSave={canSaveFilter}
        items={savedFilters}
        newFilterIcon={newFilterIcon}
        newFilterName={newFilterName}
        saveDisabled={!newFilterName.trim()}
        saveTitle={
          canSaveFilter
            ? 'Save filter'
            : 'Employee profile is required to save filters.'
        }
        onApply={onApplySavedFilter}
        onDelete={onDeleteSavedFilter}
        onIconChange={onFilterIconChange}
        onNameChange={onFilterNameChange}
        onSave={onSaveFilter}
      />
      <div className='orders-filter-grid'>
        <label className='orders-filter-field'>
          <span>Phone / name</span>
          <input
            type='text'
            value={draftFilters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
            placeholder='+380..., Ivan'
          />
        </label>
        <label className='orders-filter-field'>
          <span>Client ID</span>
          <input
            type='text'
            value={draftFilters.clientId}
            onChange={(event) => updateFilter('clientId', event.target.value)}
            placeholder='ID'
          />
        </label>
        <label className='orders-filter-field'>
          <span>Order No.</span>
          <input
            type='text'
            value={draftFilters.orderNumber}
            onChange={(event) =>
              updateFilter('orderNumber', event.target.value)
            }
            placeholder='r000001'
          />
        </label>
        <label className='orders-filter-field'>
          <span>Date from</span>
          <input
            type='date'
            value={draftFilters.dateFrom}
            onChange={(event) => updateFilter('dateFrom', event.target.value)}
          />
        </label>
        <label className='orders-filter-field'>
          <span>Date to</span>
          <input
            type='date'
            value={draftFilters.dateTo}
            onChange={(event) => updateFilter('dateTo', event.target.value)}
          />
        </label>
        <label className='orders-filter-field'>
          <span>Status</span>
          <select
            value={draftFilters.status}
            onChange={(event) =>
              updateFilter(
                'status',
                event.target.value as ClientStatus | '' | 'all',
              )
            }
          >
            {statusOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
                style={{
                  color:
                    option.value && option.value !== 'all'
                      ? getClientStatusColor(option.value as ClientStatus)
                      : '#6B7280',
                }}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>Visits from</span>
          <input
            type='number'
            min='0'
            value={draftFilters.visitsFrom}
            onChange={(event) =>
              updateFilter('visitsFrom', event.target.value)
            }
            placeholder='0'
          />
        </label>
        <label className='orders-filter-field'>
          <span>Visits to</span>
          <input
            type='number'
            min='0'
            value={draftFilters.visitsTo}
            onChange={(event) => updateFilter('visitsTo', event.target.value)}
            placeholder='0'
          />
        </label>
        <label className='orders-filter-field'>
          <span>Client income from</span>
          <input
            type='number'
            min='0'
            value={draftFilters.incomeFrom}
            onChange={(event) =>
              updateFilter('incomeFrom', event.target.value)
            }
            placeholder='0'
          />
        </label>
        <label className='orders-filter-field'>
          <span>Client income to</span>
          <input
            type='number'
            min='0'
            value={draftFilters.incomeTo}
            onChange={(event) => updateFilter('incomeTo', event.target.value)}
            placeholder='0'
          />
        </label>
      </div>
      <div className='orders-filter-actions'>
        <button
          type='button'
          className='toolbar-filter-button orders-filter-apply'
          onClick={onApply}
        >
          Apply
        </button>
        <button
          type='button'
          className='toolbar-filter-button'
          onClick={onClear}
        >
          Clear filter
        </button>
      </div>
    </section>
  );
};
