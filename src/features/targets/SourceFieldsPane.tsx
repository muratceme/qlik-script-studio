import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, GripVertical, Plus, Table2 } from 'lucide-react';
import type { FieldRef, FieldRole, Project, SourceKind } from '@/model/types';
import { IconButton, RoleBadge } from '@/components/ui';
import { SourceKindIcon } from '@/features/sources/SourceKindIcon';
import { cn } from '@/lib/cn';
import { dragId } from './dragIds';
import { resolveRef } from '@/lib/resolveRef';

interface PaneTable {
  id: string;
  name: string;
  kind: SourceKind | 'target';
  fields: { ref: FieldRef; name: string; role: FieldRole }[];
}

function paneTables(project: Project, excludeTargetId: string | null): PaneTable[] {
  const out: PaneTable[] = project.sources.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    fields: s.fields
      .filter((f) => f.role !== 'ignore')
      .map((f) => ({ ref: { tableId: s.id, fieldId: f.id }, name: f.alias ?? f.name, role: f.role })),
  }));
  for (const t of project.targets) {
    if (t.id === excludeTargetId || t.columns.length === 0) continue;
    out.push({
      id: t.id,
      name: t.name,
      kind: 'target',
      fields: t.columns.map((c) => {
        const ref = { tableId: t.id, fieldId: c.id };
        const r = resolveRef(project, ref);
        return { ref, name: r?.name ?? '?', role: r?.role ?? 'dimension' };
      }),
    });
  }
  return out;
}

export function SourceFieldsPane({
  project,
  excludeTargetId,
  onAdd,
  canAdd,
}: {
  project: Project;
  excludeTargetId: string | null;
  onAdd: (ref: FieldRef) => void;
  canAdd: boolean;
}) {
  const { t } = useTranslation();
  return (
    <aside className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t('design.sourcesPane')}</h2>
      {paneTables(project, excludeTargetId).map((table) => (
        <TableCard key={table.id} table={table} onAdd={onAdd} canAdd={canAdd} />
      ))}
    </aside>
  );
}

function TableCard({
  table,
  onAdd,
  canAdd,
}: {
  table: PaneTable;
  onAdd: (ref: FieldRef) => void;
  canAdd: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  return (
    <div
      className={cn(
        'rounded-lg border bg-surface-raised',
        table.kind === 'target' ? 'border-accent/50' : 'border-border',
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm font-medium"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-4 text-fg-subtle" />
        ) : (
          <ChevronRight className="size-4 text-fg-subtle" />
        )}
        {table.kind === 'target' ? (
          <Table2 className="size-4 text-accent" />
        ) : (
          <SourceKindIcon kind={table.kind} className="size-4 text-fg-muted" />
        )}
        <span className="truncate">{table.name}</span>
        <span className="ml-auto text-xs text-fg-subtle">{table.fields.length}</span>
      </button>
      {open ? (
        <ul className="flex flex-col border-t border-border p-1">
          {table.fields.map((field) => (
            <DraggableField
              key={field.ref.fieldId}
              field={field}
              onAdd={onAdd}
              canAdd={canAdd}
              roleLabel={t(`roles.${field.role}`)}
              addLabel={t('design.addToTarget')}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DraggableField({
  field,
  onAdd,
  canAdd,
  roleLabel,
  addLabel,
}: {
  field: PaneTable['fields'][number];
  onAdd: (ref: FieldRef) => void;
  canAdd: boolean;
  roleLabel: string;
  addLabel: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId(field.ref),
    data: { ref: field.ref },
  });
  return (
    <li
      ref={setNodeRef}
      className={cn(
        'group flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm hover:bg-surface-sunken',
        isDragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-0.5 text-fg-subtle hover:text-fg active:cursor-grabbing"
        {...listeners}
        {...attributes}
        aria-label={field.name}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="min-w-0 flex-1 truncate">{field.name}</span>
      <RoleBadge role={field.role} label={roleLabel} />
      <IconButton
        label={addLabel}
        size="sm"
        className="!size-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
        disabled={!canAdd}
        onClick={() => onAdd(field.ref)}
      >
        <Plus className="size-3.5" />
      </IconButton>
    </li>
  );
}
