import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import type { Aggregation, Project, TargetColumn, TargetTable } from '@/model/types';
import { AGGREGATIONS } from '@/model/types';
import { IconButton, RoleBadge, Select, TextInput } from '@/components/ui';
import { moveColumn, removeColumn, setColumnAggregation, updateColumn } from '@/store/targetActions';
import { previewExpr } from './exprPreview';

export function ColumnRow({
  project,
  target,
  column,
  index,
  onEdit,
}: {
  project: Project;
  target: TargetTable;
  column: TargetColumn;
  index: number;
  onEdit: (columnId: string) => void;
}) {
  const { t } = useTranslation();
  const source =
    column.kind !== 'calculated' ? project.sources.find((s) => s.id === column.ref.tableId) : undefined;
  const field =
    column.kind !== 'calculated' ? source?.fields.find((f) => f.id === column.ref.fieldId) : undefined;
  const foreign = source && source.id !== target.primarySourceId;
  const baseName = field ? (field.alias ?? field.name) : '';

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {column.kind === 'calculated' ? (
            <span
              className="truncate font-mono text-xs text-fg-muted"
              title={previewExpr(project, target, column.expr)}
            >
              ƒ {previewExpr(project, target, column.expr)}
            </span>
          ) : (
            <>
              <span className="truncate text-sm">
                {foreign ? `${source?.name}.` : ''}
                {baseName}
              </span>
              {field ? (
                <RoleBadge
                  role={column.kind === 'measure' ? 'measure' : field.role}
                  label={t(`roles.${column.kind === 'measure' ? 'measure' : field.role}`)}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
      <div className="sm:order-none order-last col-span-2 sm:col-span-1">
        {column.kind !== 'calculated' ? (
          <Select
            aria-label={t('design.aggregation')}
            className="!h-8 !text-xs"
            value={column.kind === 'measure' ? column.aggregation : ''}
            onChange={(e) =>
              setColumnAggregation(target.id, column.id, (e.target.value || null) as Aggregation | null)
            }
            options={[
              { value: '', label: t('design.noAggregation') },
              ...AGGREGATIONS.map((a) => ({ value: a, label: t(`aggregations.${a}`) })),
            ]}
          />
        ) : (
          <span className="text-xs text-fg-subtle">{t('design.calculated')}</span>
        )}
      </div>
      <div className="col-span-2 sm:col-span-1">
        <TextInput
          aria-label={t('design.renameColumn')}
          className="!h-8"
          placeholder={column.kind === 'field' ? baseName : t('common.name')}
          value={column.kind === 'field' ? (column.alias ?? '') : column.alias}
          onChange={(e) =>
            updateColumn(target.id, column.id, (c) => {
              if (c.kind === 'field') c.alias = e.target.value || null;
              else c.alias = e.target.value;
            })
          }
        />
      </div>
      <div className="flex justify-end gap-0.5">
        {column.kind === 'calculated' ? (
          <IconButton label={t('common.edit')} size="sm" onClick={() => onEdit(column.id)}>
            <Pencil className="size-3.5" />
          </IconButton>
        ) : null}
        <IconButton
          label={t('common.moveUp')}
          size="sm"
          disabled={index === 0}
          onClick={() => moveColumn(target.id, index, index - 1)}
        >
          <ArrowUp className="size-3.5" />
        </IconButton>
        <IconButton
          label={t('common.moveDown')}
          size="sm"
          disabled={index === target.columns.length - 1}
          onClick={() => moveColumn(target.id, index, index + 1)}
        >
          <ArrowDown className="size-3.5" />
        </IconButton>
        <IconButton
          label={t('design.removeColumn')}
          size="sm"
          variant="danger"
          onClick={() => removeColumn(target.id, column.id)}
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </li>
  );
}
