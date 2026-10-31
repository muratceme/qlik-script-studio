import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Sparkles, Tags, X } from 'lucide-react';
import type { DataType, FieldRole } from '@/model/types';
import { DATA_TYPES, FIELD_ROLES } from '@/model/types';
import { Button, EmptyState, RoleBadge, Select, TextInput } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { updateField } from '@/store/sourceActions';
import {
  applyAllSuggestions,
  applySuggestion,
  bulkSetRole,
  bulkSetType,
  clearSuggestions,
  suggestRoles,
} from '@/store/roleActions';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';

export function RolesStep() {
  const { t } = useTranslation();
  const sources = useProjectStore((s) => s.project.sources);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const rows = useMemo(
    () => sources.flatMap((s) => s.fields.map((f) => ({ table: s, field: f }))),
    [sources],
  );
  const suggestionCount = rows.filter((r) => r.field.suggestedRole).length;
  const allIds = rows.map((r) => r.field.id);

  if (rows.length === 0) {
    return <EmptyState icon={<Tags />} title={t('rolesStep.empty')} hint={t('rolesStep.hint')} />;
  }

  const toggle = (id: string, shift: boolean) => {
    const next = new Set(selected);
    if (shift && lastClicked) {
      const a = allIds.indexOf(lastClicked);
      const b = allIds.indexOf(id);
      const [from, to] = a < b ? [a, b] : [b, a];
      for (let i = from; i <= to; i++) next.add(allIds[i]!);
    } else if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
    setLastClicked(id);
  };

  const onSuggest = () => {
    const count = suggestRoles();
    toast(count > 0 ? t('rolesStep.suggestionsReady', { count }) : t('rolesStep.noSuggestions'));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t('rolesStep.title')}</h2>
          <p className="text-xs text-fg-muted">{t('rolesStep.hint')}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" icon={<Sparkles />} onClick={onSuggest}>
            {t('rolesStep.suggest')}
          </Button>
          {suggestionCount > 0 ? (
            <>
              <Button size="sm" variant="primary" icon={<Check />} onClick={applyAllSuggestions}>
                {t('common.applyAll')} ({suggestionCount})
              </Button>
              <Button size="sm" icon={<X />} onClick={clearSuggestions}>
                {t('rolesStep.clearSuggestions')}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-accent-soft/60 px-3 py-2 text-sm">
          <span className="font-medium">{t('rolesStep.bulkBar', { count: selected.size })}</span>
          <Select
            aria-label={t('rolesStep.setRole')}
            className="!h-8 !w-auto !text-xs"
            value=""
            placeholder={t('rolesStep.setRole')}
            onChange={(e) => e.target.value && bulkSetRole(selected, e.target.value as FieldRole)}
            options={FIELD_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
          />
          <Select
            aria-label={t('rolesStep.setType')}
            className="!h-8 !w-auto !text-xs"
            value=""
            placeholder={t('rolesStep.setType')}
            onChange={(e) => e.target.value && bulkSetType(selected, e.target.value as DataType)}
            options={DATA_TYPES.map((d) => ({ value: d, label: t(`dataTypes.${d}`) }))}
          />
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t('common.clearSelection')}
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-surface-raised text-left text-xs text-fg-muted">
            <tr>
              <th className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  aria-label={t('common.selectAll')}
                  className="accent-accent"
                  checked={selected.size === allIds.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(allIds) : new Set())}
                />
              </th>
              <th className="px-2 py-2 font-medium">{t('common.table')}</th>
              <th className="px-2 py-2 font-medium">{t('common.field')}</th>
              <th className="px-2 py-2 font-medium">{t('rolesStep.setRole')}</th>
              <th className="px-2 py-2 font-medium">{t('common.type')}</th>
              <th className="px-2 py-2 font-medium">{t('sources.alias')}</th>
              <th className="px-2 py-2 font-medium">{t('rolesStep.dateFormat')}</th>
              <th className="px-2 py-2 font-medium" title={t('rolesStep.isUniqueHint')}>
                {t('rolesStep.isUnique')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ table, field }, index) => {
              const first = index === 0 || rows[index - 1]!.table.id !== table.id;
              const isSelected = selected.has(field.id);
              return (
                <tr
                  key={field.id}
                  className={cn(
                    'border-t border-border',
                    isSelected && 'bg-accent-soft/30',
                    first && index > 0 && 'border-t-2',
                  )}
                >
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      aria-label={`${table.name}.${field.name}`}
                      checked={isSelected}
                      onClick={(e) => toggle(field.id, e.shiftKey)}
                      onChange={() => undefined}
                    />
                  </td>
                  <td className={cn('px-2 py-1 text-xs', first ? 'font-semibold text-fg' : 'text-fg-subtle')}>
                    {first ? table.name : '·'}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.name}</span>
                      {field.suggestedRole ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-accent px-2 py-px text-[11px] text-accent hover:bg-accent-soft"
                          onClick={() => applySuggestion(field.id)}
                          title={t('common.accept')}
                        >
                          <Sparkles className="size-3" />
                          {t('rolesStep.suggested', { role: t(`roles.${field.suggestedRole}`) })}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <Select
                        aria-label={t('rolesStep.setRole')}
                        className="!h-8 !w-32 !text-xs"
                        value={field.role}
                        onChange={(e) =>
                          updateField(table.id, field.id, (f) => void (f.role = e.target.value as FieldRole))
                        }
                        options={FIELD_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
                      />
                      <RoleBadge
                        role={field.role}
                        label={t(`roles.${field.role}`)}
                        className="hidden xl:inline-flex"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <Select
                      aria-label={t('common.type')}
                      className="!h-8 !w-28 !text-xs"
                      value={field.dataType}
                      onChange={(e) =>
                        updateField(table.id, field.id, (f) => void (f.dataType = e.target.value as DataType))
                      }
                      options={DATA_TYPES.map((d) => ({ value: d, label: t(`dataTypes.${d}`) }))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <TextInput
                      aria-label={t('sources.alias')}
                      className="!h-8 !w-36"
                      placeholder={t('common.optional')}
                      value={field.alias ?? ''}
                      onChange={(e) =>
                        updateField(table.id, field.id, (f) => void (f.alias = e.target.value || null))
                      }
                    />
                  </td>
                  <td className="px-2 py-1">
                    {field.dataType === 'date' || field.role === 'date' ? (
                      <TextInput
                        aria-label={t('rolesStep.dateFormat')}
                        className="!h-8 !w-32 font-mono"
                        placeholder={table.kind === 'qvd' ? '—' : 'DD.MM.YYYY'}
                        disabled={table.kind === 'qvd'}
                        title={t('rolesStep.dateFormatHint')}
                        value={field.dateFormat ?? ''}
                        onChange={(e) =>
                          updateField(table.id, field.id, (f) => void (f.dateFormat = e.target.value || null))
                        }
                      />
                    ) : (
                      <span className="text-xs text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      aria-label={t('rolesStep.isUnique')}
                      checked={field.isUnique}
                      onChange={(e) =>
                        updateField(table.id, field.id, (f) => void (f.isUnique = e.target.checked))
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
