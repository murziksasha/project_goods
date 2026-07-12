import type { ReactNode } from 'react';

export type LoadingStateProps = {
  children: ReactNode;
  className?: string;
  label?: string;
};

export const LoadingState = ({
  children,
  className = '',
  label,
}: LoadingStateProps) => (
  <p
    className={`loading-state ${className}`.trim()}
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label={label}
  >
    {children}
  </p>
);
