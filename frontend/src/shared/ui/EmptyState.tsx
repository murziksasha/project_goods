import type { ReactNode } from 'react';

export type EmptyStateProps = {
  children: ReactNode;
  className?: string;
};

export const EmptyState = ({ children, className = '' }: EmptyStateProps) => (
  <p className={`empty-state ${className}`.trim()}>{children}</p>
);
