import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { LayoutTemplate, Plus } from 'lucide-react';
import type { FieldRef } from '@/model/types';
import { Button, EmptyState } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { addFieldColumn, addTargetTable } from '@/store/targetActions';
import { fieldLabel } from './useReachableFields';
import { SourceFieldsPane } from './SourceFieldsPane';
import { parseDragId } from './dragIds';
import { TargetCard } from './TargetCard';
import { CalendarCard } from './CalendarCard';
import { ConnectTablesDialog } from '@/features/relations/ConnectTablesDialog';
import { MERGE_TYPES } from '@/generator/plan';
import { toast } from '@/components/ui/Toast';
import { Link2 } from 'lucide-react';

export function DesignStep() {
  const { t } = useTranslation();
  const project = useProjectStore((s) => s.project);
  const selectedId = useUiStore((s) => s.selectedTargetId);
  const select = useUiStore((s) => s.selectTarget);
  const [dragging, setDragging] = useState<FieldRef | null>(null);
  const [connect, setConnect] = useState<{
    targetId: string;
    primaryId: string;
    ref: FieldRef | null;
    rightTableId: string | null;
  } | null>(null);
  const [connectAny, setConnectAny] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const selectedTarget = project.targets.find((x) => x.id === selectedId) ?? project.targets[0] ?? null;

  if (project.sources.length === 0) {
    return <EmptyState icon={<LayoutTemplate />} title={t('sources.empty')} hint={t('sources.emptyHint')} />;
  }

  const onDragStart = (e: DragStartEvent) => setDragging(parseDragId(String(e.active.id)));
  /** Adds the field, or first asks how its table should be connected to the target's primary table. */
  const addField = (targetId: string, ref: FieldRef) => {
    const target = project.targets.find((x) => x.id === targetId);
    const primaryId = target?.primarySourceId;
    const connected =
      !primaryId ||
      primaryId === ref.tableId ||
      project.links.some(
        (l) => l.leftTableId === primaryId && l.rightTableId === ref.tableId && MERGE_TYPES.has(l.type),
      );
    select(targetId);
    if (connected || !primaryId) {
      addFieldColumn(targetId, ref);
      return;
    }
    setConnect({ targetId, primaryId, ref, rightTableId: ref.tableId });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const ref = parseDragId(String(e.active.id));
    const targetId = e.over ? String(e.over.id).split('|')[1] : undefined;
    if (ref && targetId) addField(targetId, ref);
  };

  const addToSelected = (ref: FieldRef) => {
    const id = selectedTarget?.id ?? addTargetTable(ref.tableId);
    addField(id, ref);
  };

  const tableName = (id: string) =>
    [...project.sources, ...project.targets].find((x) => x.id === id)?.name ?? '?';

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SourceFieldsPane sources={project.sources} onAdd={addToSelected} canAdd />
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{t('design.targetsPane')}</h2>
            <div className="ml-auto flex gap-1.5">
              <Button
                size="sm"
                icon={<Link2 />}
                onClick={() => setConnectAny(true)}
                disabled={project.sources.length + project.targets.length < 2}
              >
                {t('connect.button')}
              </Button>
              <Button size="sm" variant="primary" icon={<Plus />} onClick={() => addTargetTable()}>
                {t('design.addTarget')}
              </Button>
            </div>
          </div>
          {project.targets.length === 0 ? (
            <EmptyState
              icon={<LayoutTemplate />}
              title={t('design.empty')}
              hint={t('design.emptyHint')}
              actions={
                <Button variant="primary" icon={<Plus />} onClick={() => addTargetTable()}>
                  {t('design.addTarget')}
                </Button>
              }
            />
          ) : (
            project.targets.map((target) => (
              <TargetCard
                key={target.id}
                project={project}
                target={target}
                selected={selectedTarget?.id === target.id}
                onSelect={() => select(selectedTarget?.id === target.id ? null : target.id)}
                onConnect={(rightTableId) =>
                  target.primarySourceId &&
                  setConnect({
                    targetId: target.id,
                    primaryId: target.primarySourceId,
                    ref: null,
                    rightTableId,
                  })
                }
              />
            ))
          )}
          <CalendarCard />
        </div>
      </div>
      <ConnectTablesDialog
        open={connect !== null}
        onClose={() => setConnect(null)}
        leftTableId={connect?.primaryId ?? null}
        rightTableId={connect?.rightTableId ?? null}
        lockTables
        onCreated={(link) => {
          if (!connect) return;
          const merged = link.leftTableId === connect.primaryId && MERGE_TYPES.has(link.type);
          if (connect.ref && merged) {
            // A matching key is the same field as its counterpart in the primary table.
            const pair = link.pairs.find((p) => p.rightFieldId === connect.ref!.fieldId);
            addFieldColumn(
              connect.targetId,
              pair ? { tableId: link.leftTableId, fieldId: pair.leftFieldId } : connect.ref,
            );
            toast(
              t('connect.linked', { left: tableName(link.leftTableId), right: tableName(link.rightTableId) }),
            );
          } else if (connect.ref) {
            toast(
              t('connect.keptSeparate', {
                right: tableName(connect.ref.tableId),
                target: tableName(connect.targetId),
              }),
            );
          } else {
            toast(
              t('connect.linked', { left: tableName(link.leftTableId), right: tableName(link.rightTableId) }),
            );
          }
        }}
      />
      <ConnectTablesDialog
        open={connectAny}
        onClose={() => setConnectAny(false)}
        leftTableId={selectedTarget?.primarySourceId ?? null}
        rightTableId={null}
        onCreated={(link) =>
          toast(
            t('connect.linked', { left: tableName(link.leftTableId), right: tableName(link.rightTableId) }),
          )
        }
      />
      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="rounded-md border border-accent bg-surface px-2 py-1 text-sm shadow-lg">
            {fieldLabel(project, dragging)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
