import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PageKey } from '../../../pages/dashboard/model/types';
import { getDashboardHref } from '../../../pages/dashboard/model/types';
import { sidebarNavIcons } from '../../../shared/ui/sidebarNavIcons';

export type MobileNavItem = {
  key: PageKey | 'other';
  labelKey: string;
};

export const mobileNavPriority: PageKey[] = [
  'home',
  'orders',
  'accounting',
  'clients',
  'warehouse',
  'catalog',
  'employees',
  'settings',
];

type DashboardMobileNavProps = {
  items: MobileNavItem[];
  activePage: PageKey;
  canAccessPage: (page: PageKey) => boolean;
  onNavClick: (
    event: ReactMouseEvent<HTMLAnchorElement>,
    key: PageKey,
  ) => void;
  onOpenMore?: () => void;
};

/** Bottom tab bar for narrow layouts (≤1024px, shown via CSS). */
export const DashboardMobileNav = ({
  items,
  activePage,
  canAccessPage,
  onNavClick,
  onOpenMore,
}: DashboardMobileNavProps) => {
  const { t } = useTranslation();
  const ranked = [...items].sort((left, right) => {
    const leftRank = mobileNavPriority.indexOf(left.key as PageKey);
    const rightRank = mobileNavPriority.indexOf(right.key as PageKey);
    return leftRank - rightRank;
  });
  const visible = ranked
    .filter((item): item is { key: PageKey; labelKey: string } => {
      if (item.key === 'other') return false;
      return canAccessPage(item.key);
    })
    .slice(0, 4);

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
      {onOpenMore ? (
        <button
          type="button"
          className="mobile-bottom-nav-item"
          onClick={onOpenMore}
        >
          <span className="mobile-bottom-nav-icon" aria-hidden="true">
            ⋯
          </span>
          <span className="mobile-bottom-nav-label">{t('common.more')}</span>
        </button>
      ) : null}
    </nav>
  );
};
