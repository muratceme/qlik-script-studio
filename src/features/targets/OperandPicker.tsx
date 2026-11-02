import { useTranslation } from 'react-i18next';
import type { Expr } from '@/model/types';
import { Select, TextInput } from '@/components/ui';
import type { ReachableField } from './useReachableFields';
import { cn } from '@/lib/cn';

/**
 * Picks a simple operand: a field or a fixed value. Anything more complex is
 * shown read-only (it came from a nested builder or an import).
 */
export function OperandPicker({
  value,
  onChange,
  fields,
  label,
}: {
  value: Expr;
  onChange: (expr: Expr) => void;
  fields: ReachableField[];
  label: string;
}) {
  const { t } = useTranslation();
  const mode = value.kind === 'field' ? 'field' : value.kind === 'literal' ? 'literal' : 'other';
  const key = value.kind === 'field' ? `${value.ref.tableId}:${value.ref.fieldId}` : '';

  const setMode = (next: 'field' | 'literal') => {
    if (next === mode) return;
    if (next === 'field') {
      const first = fields[0];
      if (first) onChange({ kind: 'field', ref: first.ref });
    } else {
      onChange({ kind: 'literal', value: '' });
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-fg-muted">{label}</span>
        {mode !== 'other' ? (
          <span
            className="ml-auto inline-flex overflow-hidden rounded border border-border text-[11px]"
            role="radiogroup"
            aria-label={`${label}: ${t('common.type')}`}
          >
            {(['field', 'literal'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-1.5 py-px',
                  mode === m
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface text-fg-muted hover:bg-surface-raised',
                )}
              >
                {m === 'field' ? t('common.field') : t('formula.literal')}
              </button>
            ))}
          </span>
        ) : null}
      </div>
      {mode === 'field' ? (
        <Select
          aria-label={label}
          className="!h-8 !text-xs"
          value={key}
          placeholder={t('formula.pickField')}
          onChange={(e) => {
            const found = fields.find((f) => `${f.ref.tableId}:${f.ref.fieldId}` === e.target.value);
            if (found) onChange({ kind: 'field', ref: found.ref });
          }}
          options={fields.map((f) => ({
            value: `${f.ref.tableId}:${f.ref.fieldId}`,
            label: f.primary ? f.name : `${f.tableName}.${f.name}`,
          }))}
        />
      ) : mode === 'literal' ? (
        <TextInput
          aria-label={label}
          className="!h-8"
          value={String(value.kind === 'literal' ? value.value : '')}
          onChange={(e) => {
            const raw = e.target.value;
            const num = Number(raw);
            onChange({
              kind: 'literal',
              value:
                raw.trim() !== '' && !Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(raw.trim()) ? num : raw,
            });
          }}
        />
      ) : (
        <span className="truncate rounded-md border border-border bg-surface-sunken px-2 py-1.5 font-mono text-xs text-fg-muted">
          {t('exprKinds.' + value.kind, { defaultValue: value.kind })}
        </span>
      )}
    </div>
  );
}
