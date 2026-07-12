import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PageKey } from '../../../pages/dashboard/model/types';
import { getDashboardHref } from '../../../pages/dashboard/model/types';
import { sidebarNavIcons } from '../../../shared/ui/NavIcons';

export type MobileNavItem = {
  key: PageKey;
  labelKey: string;
};

type DashboardMobileNavProps = {
  items: MobileNavItem[];
  activePage: PageKey;
  canAccessPage: (page: PageKey) => boolean;
  onNavClick: (
    event: ReactMouseEvent<HTMLAnchorElement>,
    key: PageKey,
  ) => void;
};

/** Bottom tab bar for phone widths (≤720px). */
export const DashboardMobileNav = ({
  items,
  activePage,
  canAccessPage,
  onNavClick,
}: DashboardMobileNavProps) => {
  const { t } = useTranslation();
  const visible = items.filter((item) => canAccessPage(item.key)).slice(0, 5);

  if (visible.length === 0) return null;

  return (
    <nav className="mobile-bottom-nav" aria-label={t('common.mainMenu')}>
      {visible.map((item) => {
        const Icon = sidebarNavIcons[item.key];
        const isActive = item.key === activePage;
        return (
          <a
            key={item.key}
            href={getDashboardHref(item.key)}
            className={
              isActive
                ? 'mobile-bottom-nav-item mobile-bottom-nav-item-active'
                : 'mobile-bottom-nav-item'
            }
            aria-current={isActive ? 'page' : undefined}
            onClick={(event) => onNavClick(event, item.key)}
          >
            <span className="mobile-bottom-nav-icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="mobile-bottom-nav-label">{t(item.labelKey)}</span>
          </a>
        );
      })}
    </nav>
  );
};
