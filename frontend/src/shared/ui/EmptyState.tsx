import type React from 'react';
import type { ReactNode } from 'react';

export type EmptyStateProps = {
export interface EmptyStateProps {
  children: ReactNode;
  className?: string;
};
}

export const EmptyState = ({ children, className = '' }: EmptyStateProps) => (
  <p className={`empty-state ${className}`.trim()}>{children}</p>
);
export const EmptyState: React.FC<EmptyStateProps> = ({
  children,
  className = '',
}) => <p className={`empty-state ${className}`.trim()}>{children}</p>;
