import type { PageKey } from '../../../shared/config/routing';

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
