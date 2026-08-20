import type { PageKey } from '../../../pages/dashboard/model/types';

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
