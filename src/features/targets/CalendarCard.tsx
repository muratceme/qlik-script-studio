import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import type { DatePart, FieldRef } from '@/model/types';
import { DATE_PARTS } from '@/model/types';
import { Checkbox, Labeled, Select, TextInput } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { setCalendar, updateCalendar } from '@/store/targetActions';

export function CalendarCard() {
  const { t } = useTranslation();
  const project = useProjectStore((s) => s.project);
  const calendar = project.calendar;

  // Date fields of source tables and date columns of targets.
  const options: { key: string; label: string; ref: FieldRef }[] = [];
  for (const s of project.sources) {
    for (const f of s.fields) {
      if (f.role === 'date' || f.dataType === 'date')
        options.push({
          key: `${s.id}:${f.id}`,
          label: `${s.name}.${f.alias ?? f.name}`,
          ref: { tableId: s.id, fieldId: f.id },
        });
    }
  }
  for (const tgt of project.targets) {
    for (const c of tgt.columns) {
      if (c.kind !== 'field') continue;
      const src = project.sources.find((s) => s.id === c.ref.tableId);
      const f = src?.fields.find((x) => x.id === c.ref.fieldId);
      if (f && (f.role === 'date' || f.dataType === 'date'))
        options.push({
          key: `${tgt.id}:${c.id}`,
          label: `${tgt.name}.${c.alias ?? f.alias ?? f.name}`,
          ref: { tableId: tgt.id, fieldId: c.id },
        });
    }
  }
  const currentKey = calendar?.dateField ? `${calendar.dateField.tableId}:${calendar.dateField.fieldId}` : '';
  const enabled = calendar?.enabled ?? false;

  return (
    <section className="rounded-xl border border-border bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 size-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t('design.calendar')}</h3>
          <p className="text-xs text-fg-muted">{t('design.calendarHint')}</p>
          {options.length === 0 ? (
            <p className="mt-2 text-xs text-warning">{t('design.noDateFields')}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <Checkbox
                label={t('design.calendarEnable')}
                checked={enabled}
                onChange={(e) => setCalendar(calendar?.dateField ?? options[0]!.ref, e.target.checked)}
              />
              {enabled ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Labeled label={t('design.calendarField')}>
                    {(id) => (
                      <Select
                        id={id}
                        value={currentKey}
                        placeholder={t('formula.pickField')}
                        onChange={(e) => {
                          const found = options.find((o) => o.key === e.target.value);
                          if (found) setCalendar(found.ref, true);
                        }}
                        options={options.map((o) => ({ value: o.key, label: o.label }))}
                      />
                    )}
                  </Labeled>
                  <Labeled label={t('design.calendarTable')}>
                    {(id) => (
                      <TextInput
                        id={id}
                        value={calendar?.tableName ?? 'Calendar'}
                        onChange={(e) => updateCalendar((c) => void (c.tableName = e.target.value))}
                      />
                    )}
                  </Labeled>
                  <fieldset className="sm:col-span-2">
                    <legend className="mb-1 text-xs font-medium text-fg-muted">
                      {t('design.calendarParts')}
                    </legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {DATE_PARTS.map((part: DatePart) => (
                        <Checkbox
                          key={part}
                          label={t(`dateParts.${part}`)}
                          checked={calendar?.parts.includes(part) ?? false}
                          onChange={(e) =>
                            updateCalendar((c) => {
                              c.parts = e.target.checked
                                ? DATE_PARTS.filter((p) => p === part || c.parts.includes(p))
                                : c.parts.filter((p) => p !== part);
                            })
                          }
                        />
                      ))}
                    </div>
                  </fieldset>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
