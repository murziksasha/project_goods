import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PageKey } from '../../../pages/dashboard/model/types';
import { getDashboardHref } from '../../../pages/dashboard/model/types';

interface SidebarItem {
  key: PageKey | 'other';
  labelKey: string;
}

interface DashboardSidebarProps {
  sidebarItems: SidebarItem[];
  activePage: PageKey;
  canManageEmployees: boolean;
  currentEmployee: { name: string; role: string } | null;
  onNavClick: (
    event: React.MouseEvent<HTMLAnchorElement>,
    item: SidebarItem,
  ) => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  sidebarItems,
  activePage,
  canManageEmployees,
  currentEmployee,
  onNavClick,
}) => {
  const { t } = useTranslation();

  return (
    <aside className='app-sidebar'>
      <div className='sidebar-profile'>
        <div className='sidebar-avatar'>
          {currentEmployee?.name
            ? currentEmployee.name.charAt(0).toUpperCase()
            : '?'}
        </div>
        <div>
          <p className='sidebar-user-name'>
            {currentEmployee?.name || t('common.guest')}
          </p>
          <p className='sidebar-user-role'>
            {currentEmployee?.role || t('common.noRole')}
          </p>
        </div>
      </div>

      <nav className='sidebar-nav' aria-label={t('common.mainMenu')}>
        {sidebarItems
          .filter(
            (item) => item.key !== 'employees' || canManageEmployees,
          )
          .map((item) => {
            const isActive =
              item.key !== 'other' && item.key === activePage;
            return (
              <a
                key={item.key + item.labelKey}
                href={
                  item.key === 'other'
                    ? '#'
                    : getDashboardHref(item.key)
                }
                className={
                  isActive
                    ? 'sidebar-nav-item sidebar-nav-item-active'
                    : 'sidebar-nav-item'
                }
                onClick={(event) => onNavClick(event, item)}
              >
                {t(item.labelKey)}
              </a>
            );
          })}
      </nav>
    </aside>
  );
};