import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StepperProps {
  steps: { label: string; hint: string }[];
  current: number;
  onSelect: (index: number) => void;
}

export function Stepper({ steps, current, onSelect }: StepperProps) {
  return (
    <ol className="flex w-full items-stretch gap-2" aria-label="Progress">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.label} className="flex-1">
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                active
                  ? 'border-accent bg-accent-soft/60'
                  : 'border-border bg-surface-raised hover:bg-surface-sunken',
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  done
                    ? 'bg-accent text-accent-fg'
                    : active
                      ? 'bg-accent text-accent-fg'
                      : 'bg-surface-sunken text-fg-muted',
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg">{step.label}</span>
                <span className="hidden truncate text-xs text-fg-subtle md:block">{step.hint}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
