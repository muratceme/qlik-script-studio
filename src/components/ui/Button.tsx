import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 border-transparent',
  secondary: 'bg-surface-raised text-fg border-border hover:bg-surface-sunken',
  ghost: 'bg-transparent text-fg-muted border-transparent hover:bg-surface-sunken hover:text-fg',
  danger: 'bg-transparent text-danger border-transparent hover:bg-danger-soft',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {icon ? <span className="shrink-0 [&>svg]:size-4">{icon}</span> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: Size;
  variant?: Variant;
}

export function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4',
        VARIANT[variant],
        size === 'sm' ? 'size-8' : 'size-9',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
