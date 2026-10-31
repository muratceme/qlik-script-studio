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

export function DesignStep() {
  const { t } = useTranslation();
  const project = useProjectStore((s) => s.project);
  const selectedId = useUiStore((s) => s.selectedTargetId);
  const select = useUiStore((s) => s.selectTarget);
  const [dragging, setDragging] = useState<FieldRef | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const selectedTarget = project.targets.find((x) => x.id === selectedId) ?? project.targets[0] ?? null;

  if (project.sources.length === 0) {
    return <EmptyState icon={<LayoutTemplate />} title={t('sources.empty')} hint={t('sources.emptyHint')} />;
  }

  const onDragStart = (e: DragStartEvent) => setDragging(parseDragId(String(e.active.id)));
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const ref = parseDragId(String(e.active.id));
    const targetId = e.over ? String(e.over.id).split('|')[1] : undefined;
    if (ref && targetId) {
      addFieldColumn(targetId, ref);
      select(targetId);
    }
  };

  const addToSelected = (ref: FieldRef) => {
    const id = selectedTarget?.id ?? addTargetTable(ref.tableId);
    addFieldColumn(id, ref);
    select(id);
  };

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
            <Button
              size="sm"
              variant="primary"
              icon={<Plus />}
              className="ml-auto"
              onClick={() => addTargetTable()}
            >
              {t('design.addTarget')}
            </Button>
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
              />
            ))
          )}
          <CalendarCard />
        </div>
      </div>
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
