import type { ReactNode } from 'react';

export type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  className?: string;
};

/** Shared module header: title/count ··· primary actions, optional toolbar row. */
export const PageHeader = ({
  title,
  subtitle,
  actions,
  toolbar,
  className = '',
}: PageHeaderProps) => (
  <div className={`page-header ${className}`.trim()}>
    <div className="page-header-row">
      <div className="page-header-titles">
        <h2 className="page-header-title">{title}</h2>
        {subtitle ? (
          <p className="page-header-subtitle">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="page-header-actions">{actions}</div>
      ) : null}
    </div>
    {toolbar ? <div className="page-header-toolbar">{toolbar}</div> : null}
  </div>
);
