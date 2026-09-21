import type React from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

export interface SelectableActionLinkProps {
  children: ReactNode;
  onAction: () => void;
  className?: string;
  title?: string;
}

const hasTextSelection = () =>
  (window.getSelection()?.toString().trim().length ?? 0) > 0;

export const SelectableActionLink: React.FC<
  SelectableActionLinkProps
> = ({ children, onAction, className, title }) => {
  const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
    if (hasTextSelection()) return;
    event.preventDefault();
    onAction();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onAction();
  };

  return (
    <span
      role='button'
      tabIndex={0}
      className={className}
      title={title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </span>
  );
};
