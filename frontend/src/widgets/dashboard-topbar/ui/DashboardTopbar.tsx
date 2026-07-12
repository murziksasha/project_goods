import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../../shared/ui/LanguageSwitcher';
import { ThemeSwitcher } from '../../../shared/ui/ThemeSwitcher';

type DashboardTopbarProps = {
  serviceName: string;
  isSidebarCollapsed: boolean;
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

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-button"
          aria-label={
            isSidebarCollapsed
              ? t('common.expandMenu')
              : t('common.collapseMenu')
          }
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
            className="topbar-command-button"
            onClick={onOpenCommandPalette}
            title={t('commandPalette.title')}
            aria-label={t('commandPalette.title')}
          >
            <span aria-hidden="true">⌘K</span>
          </button>
        ) : null}
      </div>

      {lastSyncAt ? (
        <button
          type="button"
          className="topbar-sync-label topbar-sync-button"
          title={t('common.reloadData')}
          onClick={onReloadData}
        >
          {`${t('common.lastSync')}: ${new Date(lastSyncAt).toLocaleTimeString(buildLocale)}`}
        </button>
      ) : null}

      <div className="topbar-actions">
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
    </header>
  );
};
