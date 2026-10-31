import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-accent disabled:opacity-50';

export interface LabeledProps {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: (id: string) => ReactNode;
}

export function Labeled({ label, hint, className, children }: LabeledProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, 'h-9', className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, 'py-2 font-mono text-xs leading-relaxed', className)} {...rest} />;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export function Select({ options, placeholder, className, value, ...rest }: SelectProps) {
  return (
    <select className={cn(CONTROL, 'h-9 pr-8', className)} value={value ?? ''} {...rest}>
      {placeholder !== undefined ? (
        <option value="" disabled={rest.required}>
          {placeholder}
        </option>
      ) : null}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: ReactNode;
}

export function Checkbox({ label, hint, className, ...rest }: CheckboxProps) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 accent-accent" {...rest} />
      <div className="flex flex-col">
        <label htmlFor={id} className="text-sm text-fg">
          {label}
        </label>
        {hint ? <span className="text-xs text-fg-subtle">{hint}</span> : null}
      </div>
    </div>
  );
}
