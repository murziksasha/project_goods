import { useState } from 'react';
import { filterIconOptions } from './orders-workspace-shared';

export type SavedFilterViewItem = {
  id: string;
  name: string;
  icon: string;
};

type SavedFiltersPanelProps = {
  canSave: boolean;
  items: SavedFilterViewItem[];
  newFilterIcon: string;
  newFilterName: string;
  saveDisabled?: boolean;
  saveTitle?: string;
  onApply: (id: string) => void;
  onDelete: (id: string) => void;
  onIconChange: (icon: string) => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
};

export const SavedFiltersPanel = ({
  canSave,
  items,
  newFilterIcon,
  newFilterName,
  saveDisabled = false,
  saveTitle,
  onApply,
  onDelete,
  onIconChange,
  onNameChange,
  onSave,
}: SavedFiltersPanelProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <div className='orders-filter-saved-row'>
        <div className='orders-filter-saved-list'>
          <strong>Saved filters:</strong>
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className='orders-filter-saved-item'>
                <button
                  type='button'
                  className='orders-filter-saved-button'
                  onClick={() => onApply(item.id)}
                >
                  {`${item.icon} ${item.name}`}
                </button>
                <button
                  type='button'
                  className='orders-filter-delete-button'
                  onClick={() => onDelete(item.id)}
                  aria-label={`Delete ${item.name}`}
                >
                  x
                </button>
              </div>
            ))
          ) : (
            <small>No saved filters for this tab.</small>
          )}
        </div>
        <button
          type='button'
          className='orders-filter-save-button'
          onClick={() => setIsDrawerOpen(true)}
          disabled={!canSave}
          title={saveTitle}
        >
          Save filter
        </button>
      </div>

      {isDrawerOpen ? (
        <div
          className='orders-filter-drawer-backdrop'
          onClick={() => setIsDrawerOpen(false)}
        >
          <aside
            className='orders-filter-drawer'
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h3>Save filter</h3>
              <button
                type='button'
                aria-label='Close save filter panel'
                onClick={() => setIsDrawerOpen(false)}
              >
                x
              </button>
            </header>
            <label className='orders-filter-field'>
              <span>Filter name</span>
              <input
                type='text'
                value={newFilterName}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder='My filter'
              />
            </label>
            <div className='orders-filter-icons'>
              <span>Choose icon</span>
              <div className='orders-filter-icons-grid'>
                {filterIconOptions.map((icon, index) => (
                  <button
                    key={`${icon}-${index}`}
                    type='button'
                    className={
                      icon === newFilterIcon
                        ? 'orders-filter-icon-button orders-filter-icon-button-active'
                        : 'orders-filter-icon-button'
                    }
                    onClick={() => onIconChange(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className='orders-filter-drawer-preview'>
              <span>Preview</span>
              <button type='button' disabled>
                {`${newFilterIcon} ${newFilterName.trim() || 'My filter'}`}
              </button>
            </div>
            <div className='orders-filter-drawer-list'>
              <span>Your saved filters</span>
              {items.length > 0 ? (
                items.map((item) => (
                  <div key={item.id} className='orders-filter-drawer-item'>
                    <button type='button' onClick={() => onApply(item.id)}>
                      {`${item.icon} ${item.name}`}
                    </button>
                    <button
                      type='button'
                      className='orders-filter-delete-button'
                      onClick={() => onDelete(item.id)}
                      aria-label={`Delete ${item.name}`}
                    >
                      x
                    </button>
                  </div>
                ))
              ) : (
                <small>No filters yet.</small>
              )}
            </div>
            <footer>
              <button
                type='button'
                className='toolbar-filter-button orders-filter-apply'
                onClick={() => {
                  onSave();
                  setIsDrawerOpen(false);
                }}
                disabled={!canSave || saveDisabled}
              >
                Save
              </button>
              <button
                type='button'
                className='toolbar-filter-button'
                onClick={() => setIsDrawerOpen(false)}
              >
                Cancel
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
};
