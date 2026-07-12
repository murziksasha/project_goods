import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PageKey } from '../../../pages/dashboard/model/types';
import { getDashboardHref } from '../../../pages/dashboard/model/types';
import { sidebarNavIcons } from '../../../shared/ui/NavIcons';

export type DashboardSidebarItem = {
  key: PageKey | 'other';
  labelKey: string;
};

export type SidebarNavGroup = {
  id: string;
  labelKey: string;
  keys: Array<PageKey | 'other'>;
};

export const defaultSidebarGroups: SidebarNavGroup[] = [
  { id: 'home', labelKey: 'nav.groups.overview', keys: ['home'] },
  { id: 'work', labelKey: 'nav.groups.work', keys: ['orders', 'clients'] },
  { id: 'stock', labelKey: 'nav.groups.stock', keys: ['warehouse', 'catalog'] },
  { id: 'money', labelKey: 'nav.groups.money', keys: ['accounting'] },
  {
    id: 'admin',
    labelKey: 'nav.groups.admin',
    keys: ['employees', 'settings'],
  },
];

type DashboardSidebarProps = {
  sidebarItems: DashboardSidebarItem[];
  activePage: PageKey;
  isCollapsed: boolean;
  buildLabel: string;
  buildSha: string;
  currentEmployee: { name: string; role: string } | null;
  canAccessPage: (page: PageKey | 'other') => boolean;
  onNavClick: (
    event: ReactMouseEvent<HTMLAnchorElement>,
    item: DashboardSidebarItem,
  ) => void;
};

export const DashboardSidebar = ({
  sidebarItems,
  activePage,
  isCollapsed,
  buildLabel,
  buildSha,
  currentEmployee,
  canAccessPage,
  onNavClick,
}: DashboardSidebarProps) => {
  const { t } = useTranslation();
  const itemByKey = new Map(sidebarItems.map((item) => [item.key, item]));

  return (
    <aside
      className={
        isCollapsed ? 'app-sidebar app-sidebar-collapsed' : 'app-sidebar'
      }
    >
      <div className="sidebar-profile">
        <div
          className="sidebar-avatar"
          title={currentEmployee?.name || t('common.guest')}
        >
          {currentEmployee?.name
            ? currentEmployee.name
                .split(' ')
                .map((part) => part[0] ?? '')
                .join('')
                .slice(0, 2)
                .toUpperCase()
            : '?'}
        </div>
        <div
          className={
            isCollapsed
              ? 'sidebar-profile-meta sidebar-profile-meta-hidden'
              : 'sidebar-profile-meta'
          }
        >
          <p className="sidebar-user-name">
            {currentEmployee?.name || t('common.guest')}
          </p>
          <p className="sidebar-user-role">
            {currentEmployee?.role || t('common.noRole')}
          </p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label={t('common.mainMenu')}>
        {defaultSidebarGroups.map((group) => {
          const groupItems = group.keys
            .map((key) => itemByKey.get(key))
            .filter((item): item is DashboardSidebarItem => Boolean(item))
            .filter((item) => canAccessPage(item.key));

          if (groupItems.length === 0) return null;

          return (
            <div key={group.id} className="sidebar-nav-group">
              {!isCollapsed ? (
                <p className="sidebar-nav-group-label">{t(group.labelKey)}</p>
              ) : null}
              {groupItems.map((item) => {
                const isActive =
                  item.key !== 'other' && item.key === activePage;
                const label = t(item.labelKey);
                const Icon =
                  item.key !== 'other' ? sidebarNavIcons[item.key] : null;

                return (
                  <a
                    key={item.key}
                    href={
                      item.key === 'other' ? '#' : getDashboardHref(item.key)
                    }
                    className={
                      isActive
                        ? 'sidebar-nav-item sidebar-nav-item-active'
                        : 'sidebar-nav-item'
                    }
                    title={isCollapsed ? label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={(event) => onNavClick(event, item)}
                  >
                    <span className="sidebar-nav-item-icon" aria-hidden="true">
                      {Icon ? <Icon /> : <span>{'\u2022'}</span>}
                    </span>
                    <span
                      className={
                        isCollapsed
                          ? 'sidebar-nav-item-label sidebar-nav-item-label-hidden'
                          : 'sidebar-nav-item-label'
                      }
                    >
                      {label}
                    </span>
                  </a>
                );
              })}
            </div>
          );
        })}

        <div
          className={
            isCollapsed
              ? 'sidebar-build-info sidebar-build-info-collapsed'
              : 'sidebar-build-info'
          }
          title={buildLabel}
        >
          {isCollapsed ? buildSha : buildLabel}
        </div>
      </nav>
    </aside>
  );
};
