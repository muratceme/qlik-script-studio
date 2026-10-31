import type { ReactNode } from 'react';

export function EmptyState({ icon, title, hint, actions }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong p-8 text-center">
      {icon ? <div className="text-fg-subtle [&>svg]:size-10">{icon}</div> : null}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {hint ? <p className="max-w-md text-sm text-fg-muted">{hint}</p> : null}
      {actions ? <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
