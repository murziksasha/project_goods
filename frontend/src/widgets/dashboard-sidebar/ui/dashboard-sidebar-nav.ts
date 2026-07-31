import type { PageKey } from '../../../pages/dashboard/model/types';

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
