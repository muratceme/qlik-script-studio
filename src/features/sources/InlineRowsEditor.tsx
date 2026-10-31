import { useTranslation } from 'react-i18next';
import type { SourceTable } from '@/model/types';
import { Labeled, TextArea } from '@/components/ui';
import { updateSourceTable } from '@/store/sourceActions';

function toText(rows: string[][]): string {
  return rows.map((r) => r.join(', ')).join('\n');
}

function fromText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(',').map((v) => v.trim()));
}

/** Data rows (below the header) of an inline table, edited as comma-separated text. */
export function InlineRowsEditor({ table }: { table: SourceTable }) {
  const { t } = useTranslation();
  const rows = table.inline?.rows ?? [];
  const dataRows = rows.slice(1);
  return (
    <section className="rounded-xl border border-border bg-surface-raised p-4">
      <Labeled label={t('sources.inlineRows')} hint={t('sources.inlineHint')}>
        {(id) => (
          <TextArea
            id={id}
            rows={Math.min(12, Math.max(4, dataRows.length + 1))}
            defaultValue={toText(dataRows)}
            placeholder={'TR, Türkiye\nEU, Europe'}
            onBlur={(e) =>
              updateSourceTable(table.id, (tbl) => {
                if (!tbl.inline) return;
                const header = tbl.inline.rows[0] ?? tbl.fields.map((f) => f.name);
                tbl.inline.rows = [header, ...fromText(e.target.value)];
              })
            }
          />
        )}
      </Labeled>
    </section>
  );
}
