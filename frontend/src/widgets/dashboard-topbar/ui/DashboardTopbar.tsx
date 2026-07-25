import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../../shared/ui/LanguageSwitcher';
import { ThemeSwitcher } from '../../../shared/ui/ThemeSwitcher';

type DashboardTopbarProps = {
  serviceName: string;
  isSidebarCollapsed: boolean;
  isMobileNavOpen?: boolean;
  isNarrowLayout?: boolean;
  lastSyncAt: string | null;
  buildLocale: string;
  currentEmployee: { name: string; role: string };
  primaryActions?: ReactNode;
  onOpenCommandPalette?: () => void;
  onToggleSidebar: () => void;
  onReloadData: () => void;
  onLogout: () => void;
};

export const DashboardTopbar = ({
  serviceName,
  isSidebarCollapsed,
  isMobileNavOpen = false,
  isNarrowLayout = false,
  lastSyncAt,
  buildLocale,
  currentEmployee,
  primaryActions,
  onOpenCommandPalette,
  onToggleSidebar,
  onReloadData,
  onLogout,
}: DashboardTopbarProps) => {
  const { t } = useTranslation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const morePanelId = useId();
  const moreRootRef = useRef<HTMLDivElement | null>(null);

  const menuExpanded = isNarrowLayout ? isMobileNavOpen : !isSidebarCollapsed;
  const menuAriaLabel = isNarrowLayout
    ? isMobileNavOpen
      ? t('common.collapseMenu')
      : t('common.openMenu')
    : isSidebarCollapsed
      ? t('common.expandMenu')
      : t('common.collapseMenu');

  const closeMore = useCallback(() => setIsMoreOpen(false), []);

  useEffect(() => {
    if (!isMoreOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (moreRootRef.current && target && !moreRootRef.current.contains(target)) {
        closeMore();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMore();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMoreOpen, closeMore]);

  const syncLabel = lastSyncAt
    ? `${t('common.lastSync')}: ${new Date(lastSyncAt).toLocaleTimeString(buildLocale)}`
    : null;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-button"
          aria-label={menuAriaLabel}
          aria-expanded={menuExpanded}
          aria-controls={isNarrowLayout ? 'dashboard-mobile-sidebar' : undefined}
          onClick={onToggleSidebar}
        >
          &#9776;
        </button>
        <p className="topbar-title">{serviceName || t('common.serviceCRM')}</p>
        {primaryActions ? (
          <div className="topbar-primary-actions">{primaryActions}</div>
        ) : null}
        {onOpenCommandPalette ? (
          <button
            type="button"
            className="topbar-command-button topbar-desktop-only"
            onClick={onOpenCommandPalette}
            title={t('commandPalette.title')}
            aria-label={t('commandPalette.title')}
          >
            <span aria-hidden="true">⌘K</span>
          </button>
        ) : null}
      </div>

      {syncLabel ? (
        <button
          type="button"
          className="topbar-sync-label topbar-sync-button topbar-desktop-only"
          title={t('common.reloadData')}
          onClick={onReloadData}
        >
          {syncLabel}
        </button>
      ) : null}

      <div className="topbar-actions topbar-desktop-only">
        <ThemeSwitcher />
        <LanguageSwitcher />
        <div className="topbar-current-user" title={currentEmployee.name}>
          <span className="topbar-current-user-name">{currentEmployee.name}</span>
          <span className="topbar-current-user-role">{currentEmployee.role}</span>
        </div>
        <button type="button" className="ghost-button" onClick={onLogout}>
          {t('common.logout')}
        </button>
      </div>

      <div className="topbar-more topbar-mobile-only" ref={moreRootRef}>
        <button
          type="button"
          className="topbar-more-button"
          aria-label={t('common.moreActions')}
          aria-haspopup="true"
          aria-expanded={isMoreOpen}
          aria-controls={morePanelId}
          onClick={() => setIsMoreOpen((open) => !open)}
        >
          <span aria-hidden="true">⋯</span>
        </button>
        {isMoreOpen ? (
          <div
            id={morePanelId}
            className="topbar-more-panel"
            role="region"
            aria-label={t('common.moreActions')}
          >
            {onOpenCommandPalette ? (
              <button
                type="button"
                className="topbar-more-item"
                onClick={() => {
                  closeMore();
                  onOpenCommandPalette();
                }}
              >
                <span>{t('commandPalette.title')}</span>
                <span className="topbar-more-item-meta" aria-hidden="true">
                  ⌘K
                </span>
              </button>
            ) : null}
            {syncLabel ? (
              <button
                type="button"
                className="topbar-more-item topbar-sync-button"
                title={t('common.reloadData')}
                onClick={() => {
                  closeMore();
                  onReloadData();
                }}
              >
                {syncLabel}
              </button>
            ) : null}
            <div className="topbar-more-section">
              <ThemeSwitcher />
              <LanguageSwitcher />
            </div>
            <div className="topbar-more-user" title={currentEmployee.name}>
              <span className="topbar-current-user-name">{currentEmployee.name}</span>
              <span className="topbar-current-user-role">{currentEmployee.role}</span>
            </div>
            <button
              type="button"
              className="ghost-button topbar-more-logout"
              onClick={() => {
                closeMore();
                onLogout();
              }}
            >
              {t('common.logout')}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};
