import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { filterIconOptions } from './orders-workspace-shared';

export type SavedFilterViewItem = {
  id: string;
  name: string;
  icon: string;
};

export interface SavedFiltersPanelProps {
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
  onSave: () => boolean | Promise<boolean>;
}

export const SavedFiltersPanel: React.FC<SavedFiltersPanelProps> = ({
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
}) => {
  const { t } = useTranslation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const openSessionRef = useRef(0);
  const filterNamePlaceholder = t('orders.filters.drawer.filterNamePlaceholder');

  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => {
      window.removeEventListener('keydown', handleEscape, true);
    };
  }, [isDrawerOpen]);

  const handleSave = async () => {
    if (isSaving || !canSave || saveDisabled) return;
    const saveSession = openSessionRef.current;
    setIsSaving(true);
    try {
      const result = await onSave();
      if (result === true) {
        if (openSessionRef.current === saveSession) {
          setIsDrawerOpen(false);
          onNameChange('');
          onIconChange(filterIconOptions[0]);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const drawerContent = isDrawerOpen ? (
    <div
      className='orders-filter-drawer-backdrop'
      onClick={() => setIsDrawerOpen(false)}
    >
      <aside
        className='orders-filter-drawer'
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h3>{t('orders.filters.drawer.title')}</h3>
          <button
            type='button'
            aria-label={t('orders.filters.drawer.close')}
            onClick={() => setIsDrawerOpen(false)}
          >
            x
          </button>
        </header>
        <label className='orders-filter-field'>
          <span>{t('orders.filters.drawer.filterName')}</span>
          <input
            type='text'
            value={newFilterName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={filterNamePlaceholder}
          />
        </label>
        <div className='orders-filter-icons'>
          <span>{t('orders.filters.drawer.chooseIcon')}</span>
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
          <span>{t('orders.filters.drawer.preview')}</span>
          <button type='button' disabled>
            {`${newFilterIcon} ${newFilterName.trim() || filterNamePlaceholder}`}
          </button>
        </div>
        <div className='orders-filter-drawer-list'>
          <span>{t('orders.filters.drawer.yourSaved')}</span>
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className='orders-filter-drawer-item'>
                <button
                  type='button'
                  onClick={() => {
                    onApply(item.id);
                    setIsDrawerOpen(false);
                  }}
                >
                  {`${item.icon} ${item.name}`}
                </button>
                <button
                  type='button'
                  className='orders-filter-delete-button'
                  onClick={() => onDelete(item.id)}
                  aria-label={t('orders.filters.deleteFilter', { name: item.name })}
                >
                  x
                </button>
              </div>
            ))
          ) : (
            <small>{t('orders.filters.drawer.noFiltersYet')}</small>
          )}
        </div>
        <footer>
          <button
            type='button'
            className='toolbar-filter-button orders-filter-apply'
            onClick={() => {
              void handleSave();
            }}
            disabled={!canSave || saveDisabled || isSaving}
          >
            {t('orders.filters.drawer.save')}
          </button>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => setIsDrawerOpen(false)}
          >
            {t('orders.filters.drawer.cancel')}
          </button>
        </footer>
      </aside>
    </div>
  ) : null;

  return (
    <>
      <div className='orders-filter-saved-row'>
        <div className='orders-filter-saved-list'>
          <strong>{t('orders.filters.savedLabel')}</strong>
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
                  aria-label={t('orders.filters.deleteFilter', { name: item.name })}
                >
                  x
                </button>
              </div>
            ))
          ) : (
            <small>{t('orders.filters.noSaved')}</small>
          )}
        </div>
        <button
          type='button'
          className='orders-filter-save-button'
          onClick={() => {
            openSessionRef.current += 1;
            setIsDrawerOpen(true);
          }}
          disabled={!canSave}
          title={saveTitle}
        >
          {t('orders.filters.saveFilter')}
        </button>
      </div>

      {drawerContent && typeof document !== 'undefined'
        ? createPortal(drawerContent, document.body)
        : null}
    </>
  );
};
