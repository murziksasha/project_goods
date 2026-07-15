import type { ReactNode } from 'react';

export type InlineErrorProps = {
  children: ReactNode;
  className?: string;
};

export const InlineError = ({ children, className = '' }: InlineErrorProps) => (
  <p className={`inline-error ${className}`.trim()} role="alert">
    {children}
  </p>
);
