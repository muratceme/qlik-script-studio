import { useTranslation } from 'react-i18next';
import type { Expr } from '@/model/types';
import { Select, TextInput } from '@/components/ui';
import type { ReachableField } from './useReachableFields';

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

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      <div className="flex gap-1.5">
        <Select
          aria-label={`${label}: ${t('common.type')}`}
          className="!h-8 !w-32 shrink-0 !text-xs"
          value={mode}
          onChange={(e) => {
            if (e.target.value === 'field') {
              const first = fields[0];
              if (first) onChange({ kind: 'field', ref: first.ref });
            } else if (e.target.value === 'literal') {
              onChange({ kind: 'literal', value: '' });
            }
          }}
          options={[
            { value: 'field', label: t('common.field') },
            { value: 'literal', label: t('formula.literal') },
            ...(mode === 'other' ? [{ value: 'other', label: t('exprKinds.raw') }] : []),
          ]}
        />
        {mode === 'field' ? (
          <Select
            aria-label={label}
            className="!h-8 min-w-0 flex-1 !text-xs"
            value={key}
            placeholder={t('formula.pickField')}
            onChange={(e) => {
              const found = fields.find((f) => `${f.ref.tableId}:${f.ref.fieldId}` === e.target.value);
              if (found) onChange({ kind: 'field', ref: found.ref });
            }}
            options={fields.map((f) => ({
              value: `${f.ref.tableId}:${f.ref.fieldId}`,
              label: f.primary ? f.name : `${f.table.name}.${f.name}`,
            }))}
          />
        ) : mode === 'literal' ? (
          <TextInput
            aria-label={label}
            className="!h-8 min-w-0 flex-1"
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
          <span className="flex-1 truncate rounded-md border border-border bg-surface-sunken px-2 py-1.5 font-mono text-xs text-fg-muted">
            {t('exprKinds.' + value.kind, { defaultValue: value.kind })}
          </span>
        )}
      </div>
    </div>
  );
}
