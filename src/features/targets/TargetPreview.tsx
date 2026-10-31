import { useTranslation } from 'react-i18next';
import type { Project, TargetTable } from '@/model/types';
import { RoleBadge } from '@/components/ui';
import { previewExpr } from './exprPreview';

/** Column headers with roles and, when a sample file exists, the first rows. */
export function TargetPreview({ project, target }: { project: Project; target: TargetTable }) {
  const { t } = useTranslation();
  const primary = project.sources.find((s) => s.id === target.primarySourceId);
  const rows = primary?.sampleRows?.slice(0, 5) ?? [];
  const hasMeasure = target.columns.some((c) => c.kind === 'measure');

  const columns = target.columns.map((c) => {
    if (c.kind === 'calculated') {
      return {
        id: c.id,
        name: c.alias,
        role: 'dimension' as const,
        values: rows.map(() => `ƒ ${previewExpr(project, target, c.expr)}`),
        roleLabel: t('design.calculated'),
      };
    }
    const source = project.sources.find((s) => s.id === c.ref.tableId);
    const idx = source?.fields.findIndex((f) => f.id === c.ref.fieldId) ?? -1;
    const field = source?.fields[idx];
    const name = c.kind === 'measure' ? c.alias : (c.alias ?? field?.alias ?? field?.name ?? '?');
    const local = source?.id === primary?.id;
    const values = rows.map((r) =>
      c.kind === 'measure'
        ? `Σ ${t(`aggregations.${c.aggregation}`)}`
        : local && idx >= 0
          ? (r[idx] ?? '')
          : '…',
    );
    const role = c.kind === 'measure' ? 'measure' : (field?.role ?? 'dimension');
    return { id: c.id, name, role, values, roleLabel: t(`roles.${role}`) };
  });

  if (columns.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-fg-muted">{t('design.preview')}</p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.id}
                  className="whitespace-nowrap bg-surface-sunken px-2 py-1 text-left align-top font-medium"
                >
                  <div>{c.name}</div>
                  <RoleBadge role={c.role} label={c.roleLabel} className="mt-0.5" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-2 py-2 text-fg-subtle">
                  {t('design.previewNoRows')}
                </td>
              </tr>
            ) : (
              rows.map((_, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className="max-w-48 truncate whitespace-nowrap px-2 py-1 font-mono text-fg-muted"
                    >
                      {c.values[i]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {hasMeasure ? <p className="text-[11px] text-fg-subtle">{t('design.previewAggregated')}</p> : null}
    </div>
  );
}
