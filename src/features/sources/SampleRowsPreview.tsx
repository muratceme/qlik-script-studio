import { useTranslation } from 'react-i18next';
import type { SourceTable } from '@/model/types';

export function SampleRowsPreview({ table }: { table: SourceTable }) {
  const { t } = useTranslation();
  const rows = (table.sampleRows ?? []).slice(0, 5);
  return (
    <details className="rounded-md border border-border">
      <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-fg-muted">
        {t('sources.sampleRows')}
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {table.fields.map((f) => (
                <th
                  key={f.id}
                  className="whitespace-nowrap border-t border-border bg-surface-sunken px-2 py-1 text-left font-medium"
                >
                  {f.alias ?? f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {table.fields.map((f, j) => (
                  <td key={f.id} className="whitespace-nowrap px-2 py-1 font-mono text-fg-muted">
                    {row[j] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
