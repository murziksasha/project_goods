import type { HTMLAttributes, ReactNode } from 'react';

export type PanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export const Panel = ({
  className = '',
  children,
  ...props
}: PanelProps) => (
  <section className={`panel ${className}`.trim()} {...props}>
    {children}
  </section>
);

export type PanelHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  stacked?: boolean;
};

export const PanelHeader = ({
  title,
  subtitle,
  actions,
  stacked = false,
  className = '',
  ...props
}: PanelHeaderProps) => (
  <div
    className={`panel-header ${stacked ? 'panel-header-stacked' : ''} ${className}`.trim()}
    {...props}
  >
    <div>
      <h2>{title}</h2>
      {subtitle ? <p className='panel-subtitle'>{subtitle}</p> : null}
    </div>
    {actions ? (
      <div className='panel-header-row'>{actions}</div>
    ) : null}
  </div>
);