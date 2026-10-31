import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type { Condition, ConditionGroup, ConditionOp } from '@/model/types';
import { CONDITION_OPS } from '@/model/types';
import { newCondition, newConditionGroup } from '@/model/defaults';
import { Button, IconButton, Select, TextInput } from '@/components/ui';
import type { ReachableField } from './useReachableFields';
import { OperandPicker } from './OperandPicker';
import { cn } from '@/lib/cn';

function valueCount(op: ConditionOp): number {
  if (op === 'isNull' || op === 'isNotNull') return 0;
  if (op === 'between') return 2;
  if (op === 'in' || op === 'notIn') return -1;
  return 1;
}

function parseValue(raw: string): string | number {
  const trimmed = raw.trim();
  return trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : raw;
}

/**
 * Recursive AND/OR group editor. Works on a copy and reports the whole group
 * back through `onChange` so it can be used for WHERE filters and If conditions.
 */
export function FilterBuilder({
  group,
  onChange,
  fields,
  depth = 0,
}: {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  fields: ReachableField[];
  depth?: number;
}) {
  const { t } = useTranslation();

  const setItem = (index: number, item: Condition | ConditionGroup) => {
    const items = group.items.slice();
    items[index] = item;
    onChange({ ...group, items });
  };
  const removeItem = (index: number) => onChange({ ...group, items: group.items.filter((_, i) => i !== index) });
  const addCondition = () => {
    const first = fields[0];
    const left = first ? { kind: 'field' as const, ref: first.ref } : { kind: 'literal' as const, value: '' };
    onChange({ ...group, items: [...group.items, newCondition(left)] });
  };
  const addGroup = () => onChange({ ...group, items: [...group.items, newConditionGroup(group.logic === 'and' ? 'or' : 'and')] });

  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border p-2', depth === 0 ? 'border-border' : 'border-dashed border-border-strong bg-surface-sunken/40')}>
      <div className="flex items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-xs" role="radiogroup" aria-label="Logic">
          {(['and', 'or'] as const).map((logic) => (
            <button
              key={logic}
              type="button"
              role="radio"
              aria-checked={group.logic === logic}
              onClick={() => onChange({ ...group, logic })}
              className={cn('px-2.5 py-1 font-semibold', group.logic === logic ? 'bg-accent text-accent-fg' : 'bg-surface text-fg-muted hover:bg-surface-raised')}
            >
              {t(`common.${logic}`)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <Button size="sm" icon={<Plus />} onClick={addCondition}>
            {t('design.addCondition')}
          </Button>
          {depth < 2 ? (
            <Button size="sm" variant="ghost" icon={<Plus />} onClick={addGroup}>
              {t('design.addGroup')}
            </Button>
          ) : null}
        </div>
      </div>

      {group.items.map((item, index) => (
        <div key={item.id} className="flex items-start gap-1.5">
          {index > 0 ? <span className="mt-2 w-10 shrink-0 text-right text-[11px] font-semibold text-fg-subtle">{t(`common.${group.logic}`)}</span> : <span className="w-10 shrink-0" />}
          <div className="min-w-0 flex-1">
            {item.kind === 'group' ? (
              <FilterBuilder group={item} onChange={(g) => setItem(index, g)} fields={fields} depth={depth + 1} />
            ) : (
              <ConditionRow condition={item} onChange={(c) => setItem(index, c)} fields={fields} />
            )}
          </div>
          <IconButton label={t('common.remove')} size="sm" variant="danger" onClick={() => removeItem(index)}>
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

function ConditionRow({ condition, onChange, fields }: { condition: Condition; onChange: (c: Condition) => void; fields: ReachableField[] }) {
  const { t } = useTranslation();
  const count = valueCount(condition.op);
  const values = condition.values;

  const setValue = (i: number, raw: string) => {
    const next = values.slice();
    next[i] = parseValue(raw);
    onChange({ ...condition, values: next });
  };

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
      <OperandPicker label={t('common.field')} value={condition.left} onChange={(left) => onChange({ ...condition, left })} fields={fields} />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-fg-muted">{t('formula.operator')}</span>
        <Select
          aria-label={t('formula.operator')}
          className="!h-8 !text-xs"
          value={condition.op}
          onChange={(e) => {
            const op = e.target.value as ConditionOp;
            const n = valueCount(op);
            const next = n === 0 ? [] : n === 2 ? [values[0] ?? '', values[1] ?? ''] : n === 1 ? [values[0] ?? ''] : values.length ? values : [''];
            onChange({ ...condition, op, values: next });
          }}
          options={CONDITION_OPS.map((op) => ({ value: op, label: t(`ops.${op}`) }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-fg-muted">{count === -1 ? t('common.values') : t('common.value')}</span>
        {count === 0 ? (
          <span className="text-xs text-fg-subtle">—</span>
        ) : count === -1 ? (
          <TextInput
            aria-label={t('common.values')}
            className="!h-8"
            placeholder="a, b, c"
            value={values.join(', ')}
            onChange={(e) => onChange({ ...condition, values: e.target.value.split(',').map((v) => parseValue(v.trim())) })}
          />
        ) : (
          <div className="flex gap-1">
            {Array.from({ length: count }).map((_, i) => (
              <TextInput key={i} aria-label={`${t('common.value')} ${i + 1}`} className="!h-8" value={String(values[i] ?? '')} onChange={(e) => setValue(i, e.target.value)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
