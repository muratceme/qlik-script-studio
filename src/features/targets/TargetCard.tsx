import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, Filter, Plus, Sigma, Table2, Trash2 } from 'lucide-react';
import type { Project, TargetTable } from '@/model/types';
import { Badge, Button, Checkbox, IconButton, Labeled, Select, TextInput } from '@/components/ui';
import { removeTargetTable, updateTarget } from '@/store/targetActions';
import { ColumnRow } from './ColumnRow';
import { FilterBuilder } from './FilterBuilder';
import { FormulaDialog } from './FormulaDialog';
import { TargetPreview } from './TargetPreview';
import { useReachableFields } from './useReachableFields';
import { newConditionGroup } from '@/model/defaults';
import { cn } from '@/lib/cn';

export function TargetCard({
  project,
  target,
  selected,
  onSelect,
}: {
  project: Project;
  target: TargetTable;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: `target|${target.id}`, data: { targetId: target.id } });
  const fields = useReachableFields(target);
  const [formula, setFormula] = useState<{ open: boolean; columnId: string | null }>({
    open: false,
    columnId: null,
  });
  const [showFilter, setShowFilter] = useState(!!target.filter);

  const measureCount = target.columns.filter((c) => c.kind === 'measure').length;
  const groupBy = measureCount > 0 ? target.columns.filter((c) => c.kind !== 'measure') : [];
  const sourceOptions = [...project.sources, ...project.targets.filter((x) => x.id !== target.id)].map(
    (s) => ({ value: s.id, label: s.name }),
  );

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'rounded-xl border bg-surface-raised transition-colors',
        isOver ? 'border-accent ring-2 ring-accent/40' : selected ? 'border-accent' : 'border-border',
      )}
      aria-label={target.name}
    >
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={onSelect}
          aria-expanded={selected}
        >
          {selected ? (
            <ChevronDown className="size-4 text-fg-subtle" />
          ) : (
            <ChevronRight className="size-4 text-fg-subtle" />
          )}
          <Table2 className="size-4 text-accent" />
          <span className="truncate text-sm font-semibold">{target.name}</span>
          <Badge>{target.columns.length}</Badge>
          {measureCount > 0 ? (
            <Badge tone="accent">
              <Sigma className="mr-1 size-3" />
              {t('design.groupBy')}
            </Badge>
          ) : null}
          {target.store.enabled ? <Badge tone="success">QVD</Badge> : null}
        </button>
        <IconButton
          label={t('common.delete')}
          size="sm"
          variant="danger"
          onClick={() =>
            window.confirm(t('common.confirmDelete', { name: target.name })) && removeTargetTable(target.id)
          }
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </header>

      {selected ? (
        <div className="flex flex-col gap-4 border-t border-border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Labeled label={t('design.targetName')}>
              {(id) => (
                <TextInput
                  id={id}
                  value={target.name}
                  onChange={(e) => updateTarget(target.id, (tg) => void (tg.name = e.target.value))}
                />
              )}
            </Labeled>
            <Labeled label={t('design.primarySource')} hint={t('design.primarySourceHint')}>
              {(id) => (
                <Select
                  id={id}
                  value={target.primarySourceId ?? ''}
                  placeholder="—"
                  onChange={(e) =>
                    updateTarget(target.id, (tg) => void (tg.primarySourceId = e.target.value || null))
                  }
                  options={sourceOptions}
                />
              )}
            </Labeled>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('design.columns')}
              </h4>
              <div className="ml-auto flex gap-1.5">
                <Button
                  size="sm"
                  icon={<Plus />}
                  onClick={() => setFormula({ open: true, columnId: null })}
                  disabled={!target.primarySourceId}
                >
                  {t('design.addCalculated')}
                </Button>
                <Button
                  size="sm"
                  icon={<Filter />}
                  variant={showFilter ? 'primary' : 'secondary'}
                  onClick={() => setShowFilter(!showFilter)}
                >
                  {t('design.filter')}
                </Button>
              </div>
            </div>
            {target.columns.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-border-strong p-6 text-center">
                <p className="text-sm font-medium">{t('design.dropHere')}</p>
                <p className="text-xs text-fg-muted">{t('design.dropHint')}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {target.columns.map((column, index) => (
                  <ColumnRow
                    key={column.id}
                    project={project}
                    target={target}
                    column={column}
                    index={index}
                    onEdit={(columnId) => setFormula({ open: true, columnId })}
                  />
                ))}
              </ul>
            )}
            {groupBy.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-medium text-fg-muted">{t('design.groupBy')}:</span>
                {groupBy.map((c) => (
                  <Badge key={c.id} tone="accent">
                    {c.kind === 'field'
                      ? (c.alias ?? fields.find((f) => f.ref.fieldId === c.ref.fieldId)?.name ?? '?')
                      : c.alias}
                  </Badge>
                ))}
                <span className="text-fg-subtle">· {t('design.groupByAuto')}</span>
              </div>
            ) : null}
          </div>

          {showFilter ? (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('design.filter')}
              </h4>
              <FilterBuilder
                group={target.filter ?? newConditionGroup('and')}
                onChange={(group) =>
                  updateTarget(target.id, (tg) => void (tg.filter = group.items.length > 0 ? group : null))
                }
                fields={fields}
              />
              {!target.filter ? <p className="mt-1 text-xs text-fg-subtle">{t('design.noFilter')}</p> : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Checkbox
              label={t('design.distinct')}
              checked={target.distinct}
              onChange={(e) => updateTarget(target.id, (tg) => void (tg.distinct = e.target.checked))}
            />
            <Checkbox
              label={t('design.keepInModel')}
              hint={t('design.keepInModelHint')}
              checked={target.keepInModel}
              onChange={(e) => updateTarget(target.id, (tg) => void (tg.keepInModel = e.target.checked))}
            />
            <Checkbox
              label={t('design.store')}
              checked={target.store.enabled}
              onChange={(e) => updateTarget(target.id, (tg) => void (tg.store.enabled = e.target.checked))}
            />
            {target.store.enabled ? (
              <Labeled label={t('design.storePath')} hint={t('design.storePathHint')}>
                {(id) => (
                  <TextInput
                    id={id}
                    className="!h-8"
                    placeholder={`${project.settings.qvdStorePath}${target.name}.qvd`}
                    value={target.store.path}
                    onChange={(e) => updateTarget(target.id, (tg) => void (tg.store.path = e.target.value))}
                  />
                )}
              </Labeled>
            ) : null}
          </div>

          <TargetPreview project={project} target={target} />
          <FormulaDialog
            open={formula.open}
            onClose={() => setFormula({ open: false, columnId: null })}
            target={target}
            editColumnId={formula.columnId}
          />
        </div>
      ) : null}
    </section>
  );
}
