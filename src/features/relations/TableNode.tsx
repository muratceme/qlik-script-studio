import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Table2 } from 'lucide-react';
import type { FieldRole, SourceKind } from '@/model/types';
import { RoleBadge } from '@/components/ui';
import { SourceKindIcon } from '@/features/sources/SourceKindIcon';
import { cn } from '@/lib/cn';
import { handleId, NODE_WIDTH, type TableNode as TableNodeType } from './graph';

function TableNodeComponent({ data, selected }: NodeProps<TableNodeType>) {
  const { t } = useTranslation();
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className={cn(
        'rounded-lg border bg-surface text-fg shadow-sm',
        data.problem
          ? 'border-danger ring-2 ring-danger/30'
          : selected
            ? 'border-accent ring-2 ring-accent/30'
            : 'border-border-strong',
      )}
    >
      <header
        className={cn(
          'flex items-center gap-2 rounded-t-lg border-b border-border px-2 py-2 text-sm font-semibold',
          data.kind === 'target' ? 'bg-accent-soft/60' : 'bg-surface-raised',
        )}
      >
        {data.kind === 'source' && data.sourceKind ? (
          <SourceKindIcon kind={data.sourceKind as SourceKind} className="size-4 text-fg-muted" />
        ) : (
          <Table2 className="size-4 text-accent" />
        )}
        <span className="min-w-0 flex-1 truncate" title={data.name}>
          {data.name}
        </span>
        {data.problem ? (
          <AlertTriangle className="size-4 text-danger" aria-label={t('relations.legendProblem')} />
        ) : null}
      </header>
      <ul className="py-1">
        {data.fields.length === 0 ? <li className="px-2 py-1 text-xs text-fg-subtle">—</li> : null}
        {data.fields.map((field) => (
          <li key={field.id} className="relative flex h-[26px] items-center gap-2 px-2 text-xs">
            <Handle
              type="target"
              position={Position.Left}
              id={handleId(data.tableId, field.id)}
              className="!size-2.5 !border-2"
              aria-label={`${data.name}.${field.name}`}
            />
            <span className="min-w-0 flex-1 truncate">{field.name}</span>
            <RoleBadge role={field.role as FieldRole} label={t(`roles.${field.role}`)} />
            <Handle
              type="source"
              position={Position.Right}
              id={handleId(data.tableId, field.id)}
              className="!size-2.5 !border-2"
              aria-label={`${data.name}.${field.name}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
