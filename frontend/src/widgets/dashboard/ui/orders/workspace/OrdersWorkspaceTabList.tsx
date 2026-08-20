import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { orderTabs, type OrdersTab } from './orders-workspace-shared';

type OrdersWorkspaceTabListProps = {
  activeTab: OrdersTab;
  visibleTabs: OrdersTab[];
  permittedTabs?: OrdersTab[];
  onActiveTabChange: (tab: OrdersTab) => void;
  onToggleTabVisibility?: (tab: OrdersTab) => void;
};

export const OrdersWorkspaceTabList = ({
  activeTab,
  visibleTabs,
  permittedTabs,
  onActiveTabChange,
  onToggleTabVisibility,
}: OrdersWorkspaceTabListProps) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const checkboxTabs = permittedTabs ?? visibleTabs;
  const showGear = Boolean(onToggleTabVisibility) && checkboxTabs.length > 0;
  const visibleCount = checkboxTabs.filter((tab) =>
    visibleTabs.includes(tab),
  ).length;

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="orders-tabs-row">
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
              role="tab"
              aria-selected={tab.key === activeTab}
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
      {showGear ? (
        <div className="orders-tabs-settings toolbar-settings" ref={menuRef}>
          <button
            type="button"
            className="toolbar-square-button orders-tabs-settings-button"
            aria-label={t('orders.toolbar.toggleTabs')}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            onClick={() => setIsMenuOpen((current) => !current)}
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
          {isMenuOpen ? (
            <div className="toolbar-settings-menu">
              {orderTabs
                .filter((tab) => checkboxTabs.includes(tab.key))
                .map((tab) => {
                  const checked = visibleTabs.includes(tab.key);
                  const disabled = checked && visibleCount <= 1;

                  return (
                    <label
                      key={tab.key}
                      className="toolbar-settings-option"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        title={
                          disabled
                            ? t('orders.toolbar.lastVisibleTab')
                            : undefined
                        }
                        onChange={() => onToggleTabVisibility?.(tab.key)}
                      />
                      <span>{t(tab.labelKey)}</span>
                    </label>
                  );
                })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
