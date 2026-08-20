import type { ReactElement } from 'react';
import type { PageKey } from '../../pages/dashboard/model/types';
import type { SVGProps } from 'react';
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

type IconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export const sidebarNavIcons: Record<
  PageKey,
  (props: IconProps) => ReactElement
> = {
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
