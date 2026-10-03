import type React from 'react';
import type { ReactNode } from 'react';

export interface LoadingStateProps {
  children: ReactNode;
  className?: string;
  label?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  children,
  className = '',
  label,
}) => (
  <p
    className={`loading-state ${className}`.trim()}
    role='status'
    aria-live='polite'
    aria-busy='true'
    aria-label={label}
  >
    {children}
  </p>
);
