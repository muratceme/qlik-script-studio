import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { cn } from '@/lib/cn';
import type { LinkEdge as LinkEdgeType } from './graph';
import { useEdgeClick } from './edgeClick';

function LinkEdgeComponent({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd }: EdgeProps<LinkEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const onLabelClick = useEdgeClick();
  const implicit = data?.type === 'implicit';
  const problem = data?.problem ?? false;
  const merge = data?.type !== 'association' && data?.type !== 'noConcatenate' && !implicit;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={merge ? markerEnd : undefined}
        style={{
          stroke: problem ? 'var(--danger)' : selected ? 'var(--accent)' : implicit ? 'var(--fg-subtle)' : 'var(--border-strong)',
          strokeWidth: selected || problem ? 2.5 : 1.8,
          strokeDasharray: implicit ? '4 4' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          onClick={() => data?.linkId && onLabelClick(data.linkId)}
          disabled={!data?.linkId}
          title={data?.label}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className={cn(
            'nodrag nopan pointer-events-auto absolute max-w-40 truncate rounded border px-1.5 py-px text-[10px] font-semibold shadow-sm',
            data?.linkId ? 'cursor-pointer' : 'cursor-default',
            problem ? 'border-danger bg-danger-soft text-danger' : implicit ? 'border-border bg-surface text-fg-subtle' : 'border-border bg-surface-raised text-fg-muted',
          )}
        >
          {data?.label}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export const LinkEdge = memo(LinkEdgeComponent);
