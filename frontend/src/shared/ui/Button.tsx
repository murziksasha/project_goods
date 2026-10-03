import type React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'success'
  | 'warning'
  | 'danger';

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'primary-button',
  secondary: 'secondary-button',
  ghost: 'ghost-button',
  success: 'success-button',
  warning: 'warning-button',
  danger: 'danger-button',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={`${variantClassName[variant]} ${className}`.trim()}
    {...props}
  >
    {children}
  </button>
);
