import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, GripVertical, Plus } from 'lucide-react';
import type { FieldRef, SourceTable } from '@/model/types';
import { IconButton, RoleBadge } from '@/components/ui';
import { SourceKindIcon } from '@/features/sources/SourceKindIcon';
import { cn } from '@/lib/cn';
import { dragId } from './dragIds';

export function SourceFieldsPane({ sources, onAdd, canAdd }: { sources: SourceTable[]; onAdd: (ref: FieldRef) => void; canAdd: boolean }) {
  const { t } = useTranslation();
  return (
    <aside className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t('design.sourcesPane')}</h2>
      {sources.map((table) => (
        <SourceCard key={table.id} table={table} onAdd={onAdd} canAdd={canAdd} />
      ))}
    </aside>
  );
}

function SourceCard({ table, onAdd, canAdd }: { table: SourceTable; onAdd: (ref: FieldRef) => void; canAdd: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const fields = table.fields.filter((f) => f.role !== 'ignore');
  return (
    <div className="rounded-lg border border-border bg-surface-raised">
      <button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm font-medium" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown className="size-4 text-fg-subtle" /> : <ChevronRight className="size-4 text-fg-subtle" />}
        <SourceKindIcon kind={table.kind} className="size-4 text-fg-muted" />
        <span className="truncate">{table.name}</span>
        <span className="ml-auto text-xs text-fg-subtle">{fields.length}</span>
      </button>
      {open ? (
        <ul className="flex flex-col border-t border-border p-1">
          {fields.map((field) => (
            <DraggableField key={field.id} tableId={table.id} field={field} onAdd={onAdd} canAdd={canAdd} roleLabel={t(`roles.${field.role}`)} addLabel={t('design.addToTarget')} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DraggableField({
  tableId,
  field,
  onAdd,
  canAdd,
  roleLabel,
  addLabel,
}: {
  tableId: string;
  field: SourceTable['fields'][number];
  onAdd: (ref: FieldRef) => void;
  canAdd: boolean;
  roleLabel: string;
  addLabel: string;
}) {
  const ref: FieldRef = { tableId, fieldId: field.id };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId(ref), data: { ref } });
  return (
    <li
      ref={setNodeRef}
      className={cn('group flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm hover:bg-surface-sunken', isDragging && 'opacity-40')}
    >
      <button type="button" className="cursor-grab touch-none rounded p-0.5 text-fg-subtle hover:text-fg active:cursor-grabbing" {...listeners} {...attributes} aria-label={`${field.alias ?? field.name}`}>
        <GripVertical className="size-4" />
      </button>
      <span className="min-w-0 flex-1 truncate">{field.alias ?? field.name}</span>
      <RoleBadge role={field.role} label={roleLabel} />
      <IconButton label={addLabel} size="sm" className="!size-6 opacity-0 group-hover:opacity-100 focus:opacity-100" disabled={!canAdd} onClick={() => onAdd(ref)}>
        <Plus className="size-3.5" />
      </IconButton>
    </li>
  );
}
