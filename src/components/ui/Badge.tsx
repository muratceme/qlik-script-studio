import type { ReactNode } from 'react';
import type { FieldRole } from '@/model/types';
import { cn } from '@/lib/cn';

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'neutral' | 'accent' | 'danger' | 'warning' | 'success';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4',
        tone === 'neutral' && 'border-border bg-surface-raised text-fg-muted',
        tone === 'accent' && 'border-transparent bg-accent-soft text-fg',
        tone === 'danger' && 'border-transparent bg-danger-soft text-danger',
        tone === 'warning' && 'border-transparent bg-warning-soft text-warning',
        tone === 'success' && 'border-transparent bg-success-soft text-success',
        className,
      )}
    >
      {children}
    </span>
  );
}

const ROLE_CLASS: Record<FieldRole, string> = {
  dimension: 'text-role-dimension border-role-dimension/40',
  measure: 'text-role-measure border-role-measure/40',
  key: 'text-role-key border-role-key/40',
  date: 'text-role-date border-role-date/40',
  ignore: 'text-role-ignore border-role-ignore/40 line-through',
};

export function RoleBadge({
  role,
  label,
  className,
}: {
  role: FieldRole;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border bg-surface px-1.5 py-px text-[11px] font-medium',
        ROLE_CLASS[role],
        className,
      )}
    >
      {label}
    </span>
  );
}
