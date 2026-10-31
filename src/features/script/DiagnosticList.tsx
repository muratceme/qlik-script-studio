import { useTranslation } from 'react-i18next';
import { AlertTriangle, OctagonX, Wrench } from 'lucide-react';
import type { Diagnostic, Fix } from '@/generator';
import { Button } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { applyFix, describeFixParams } from '@/store/fixes';
import { cn } from '@/lib/cn';

export function DiagnosticList({ items, compact = false }: { items: Diagnostic[]; compact?: boolean }) {
  const { t } = useTranslation();
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);

  if (items.length === 0) return null;

  const translateParams = (d: Diagnostic): Record<string, string> => {
    const params = { ...d.params };
    if (params.what) params.what = t(`whatNames.${params.what}`, { defaultValue: params.what });
    if (params.leftType) params.leftType = t(`dataTypes.${params.leftType}`, { defaultValue: params.leftType });
    if (params.rightType) params.rightType = t(`dataTypes.${params.rightType}`, { defaultValue: params.rightType });
    return params;
  };

  const fixLabel = (fix: Fix): string => {
    const params = describeFixParams(project, fix);
    if (fix.kind === 'createLink') params.type = t(`linkTypes.${fix.type}`);
    if (fix.kind === 'setRole') params.role = t(`roles.${fix.role}`);
    return t(`fixes.${fix.kind}`, params);
  };

  return (
    <ul className={cn('flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
      {items.map((d, i) => (
        <li
          key={`${d.code}-${i}`}
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            d.severity === 'error' ? 'border-danger/40 bg-danger-soft/40' : 'border-warning/40 bg-warning-soft/40',
          )}
        >
          <div className="flex items-start gap-2">
            {d.severity === 'error' ? (
              <OctagonX className="mt-0.5 size-4 shrink-0 text-danger" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-fg">{t(`diagnostics.${d.code}`, translateParams(d))}</p>
              {d.fixes.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {d.fixes.map((fix, j) => (
                    <Button key={j} size="sm" icon={<Wrench />} onClick={() => update((p) => applyFix(p, fix))}>
                      {fixLabel(fix)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
