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
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.08V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.08-.4H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.08V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 .4 1.08 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.24.3.4.66.4 1.05v.1c0 .39-.16.76-.4 1.05-.3.36-.47.8-.4 1.25z" />
  </IconShell>
);

export const EmployeesIcon = (props: IconProps) => (
  <IconShell {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="3.5" />
    <path d="M22 21v-2a3.5 3.5 0 0 0-2.6-3.35" />
    <circle cx="17.5" cy="8" r="2.5" />
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
