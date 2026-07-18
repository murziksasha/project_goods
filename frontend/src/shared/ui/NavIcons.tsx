import type { ReactElement, SVGProps } from 'react';
import type { PageKey } from '../../pages/dashboard/model/types';

type IconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

const baseProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

const IconShell = ({ title, children, ...props }: IconProps) => (
  <svg {...baseProps} {...props}>
    {title ? <title>{title}</title> : null}
    {children}
  </svg>
);

export const HomeIcon = (props: IconProps) => (
  <IconShell {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </IconShell>
);

export const OrdersIcon = (props: IconProps) => (
  <IconShell {...props}>
    <path d="M7 3h10v18H7z" />
    <path d="M10 7h4M10 11h4M10 15h2" />
  </IconShell>
);

export const ClientsIcon = (props: IconProps) => (
  <IconShell {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="3.5" />
    <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35" />
    <path d="M16.5 3.6a3.5 3.5 0 0 1 0 6.8" />
  </IconShell>
);

export const AccountingIcon = (props: IconProps) => (
  <IconShell {...props}>
    <path d="M12 3v18" />
    <path d="M16.5 7.5c0-1.8-2-3-4.5-3s-4.5 1.2-4.5 3 2 3 4.5 3 4.5 1.2 4.5 3-2 3-4.5 3-4.5-1.2-4.5-3" />
  </IconShell>
);

export const CatalogIcon = (props: IconProps) => (
  <IconShell {...props}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
    <path d="M4 5.5V21.5" />
  </IconShell>
);

export const WarehouseIcon = (props: IconProps) => (
  <IconShell {...props}>
    <path d="M3 9.5 12 3l9 6.5V21H3z" />
    <path d="M9 21v-7h6v7" />
  </IconShell>
);

export const SettingsIcon = (props: IconProps) => (
  <IconShell {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
  </IconShell>
);

export const EmployeesIcon = (props: IconProps) => (
  <IconShell {...props}>
    <rect x="5" y="3.5" width="14" height="17" rx="2" />
    <circle cx="12" cy="9" r="2.25" />
    <path d="M8.5 16.5c.7-1.6 2-2.5 3.5-2.5s2.8.9 3.5 2.5" />
    <path d="M9 3.5V2.75A1.25 1.25 0 0 1 10.25 1.5h3.5A1.25 1.25 0 0 1 15 2.75V3.5" />
  </IconShell>
);

export const sidebarNavIcons: Record<
  PageKey,
  (props: IconProps) => ReactElement
> = {
  home: HomeIcon,
  orders: OrdersIcon,
  clients: ClientsIcon,
  accounting: AccountingIcon,
  catalog: CatalogIcon,
  warehouse: WarehouseIcon,
  settings: SettingsIcon,
  employees: EmployeesIcon,
};
