import type React from 'react';
import type { ReactNode } from 'react';

export type InlineErrorProps = {
  children: ReactNode;
export interface InlineErrorProps {
  message?: ReactNode;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  className = '',
}) => {
  if (!message) return null;

  return (
    <p className={`inline-error-banner ${className}`.trim()} role="alert">
      {message}
    </p>
  );
};

export const InlineError = ({ children, className = '' }: InlineErrorProps) => (
  <p className={`inline-error ${className}`.trim()} role="alert">
    {children}
  </p>
);
