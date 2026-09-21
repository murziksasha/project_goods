import type React from 'react';
import type { ReactNode } from 'react';

export interface InlineErrorProps {
  children?: ReactNode;
  message?: ReactNode;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  children,
  message,
  className = '',
}) => {
  const content = children ?? message;
  if (!content) return null;

  return (
    <p className={`inline-error ${className}`.trim()} role='alert'>
      {content}
    </p>
  );
};
