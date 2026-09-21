import type { FC } from 'react';
import type { PageKey } from '../config/routing';
import type { IconProps } from './NavIcons';
import {
  AccountingIcon,
  CatalogIcon,
  ClientsIcon,
  EmployeesIcon,
  HomeIcon,
  KanbanIcon,
  OrdersIcon,
  SettingsIcon,
  WarehouseIcon,
} from './NavIcons';

export const sidebarNavIcons: Record<PageKey, FC<IconProps>> = {
  home: HomeIcon,
  orders: OrdersIcon,
  kanban: KanbanIcon,
  clients: ClientsIcon,
  accounting: AccountingIcon,
  catalog: CatalogIcon,
  warehouse: WarehouseIcon,
  settings: SettingsIcon,
  employees: EmployeesIcon,
};
