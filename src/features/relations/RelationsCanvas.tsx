import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import type { Link } from '@/model/types';
import { newLink } from '@/model/defaults';
import { Button, EmptyState } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { setNodePosition } from '@/store/linkActions';
import { useScript } from '@/features/script/useScript';
import { DiagnosticList } from '@/features/script/DiagnosticList';
import { buildEdges, buildNodes, parseHandleId, type TableNode as TableNodeType } from './graph';
import { TableNode } from './TableNode';
import { LinkEdge } from './LinkEdge';
import { LinkDialog } from './LinkDialog';
import { cn } from '@/lib/cn';
import { EdgeClickContext } from './edgeClick';

const nodeTypes = { table: TableNode };
const edgeTypes = { link: LinkEdge };

function Canvas() {
  const { t } = useTranslation();
  const project = useProjectStore((s) => s.project);
  const result = useScript();
  const diagnostics = useMemo(() => [...result.errors, ...result.warnings], [result]);
  const { fitView } = useReactFlow();

  const modelNodes = useMemo(() => buildNodes(project, diagnostics), [project, diagnostics]);
  const edges = useMemo(() => buildEdges(project, diagnostics), [project, diagnostics]);
  const [nodes, setNodes] = useState<TableNodeType[]>(modelNodes);
  const [dialogLink, setDialogLink] = useState<Link | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(true);

  // Keep local node state (needed for smooth dragging) in sync with the model.
  useEffect(() => setNodes(modelNodes), [modelNodes]);

  const onNodesChange = useCallback((changes: NodeChange<TableNodeType>[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
    for (const change of changes) {
      if (change.type === 'position' && change.dragging === false && change.position)
        setNodePosition(change.id, change.position);
    }
  }, []);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    const from = parseHandleId(connection.sourceHandle);
    const to = parseHandleId(connection.targetHandle);
    if (!from || !to || from.tableId === to.tableId) return;
    // Dragging from A to B: B is the table merged into (left), A is loaded resident (right).
    const link = newLink('association', to.tableId, from.tableId);
    link.pairs = [{ leftFieldId: to.fieldId, rightFieldId: from.fieldId }];
    setDialogLink(link);
  }, []);

  const openLink = useCallback(
    (linkId: string) => {
      const link = project.links.find((l) => l.id === linkId);
      if (link) setDialogLink(link);
    },
    [project.links],
  );

  const onEdgeClick = useCallback(
    (_: unknown, edge: Edge) => {
      const linkId = (edge.data as { linkId?: string | null } | undefined)?.linkId;
      if (linkId) openLink(linkId);
    },
    [openLink],
  );

  if (project.sources.length === 0) {
    return <EmptyState icon={<Share2 />} title={t('relations.empty')} hint={t('relations.emptyHint')} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-fg-muted">
        <Share2 className="size-4 text-accent" />
        <span>{t('relations.canvasHint')}</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded-sm border border-border-strong bg-surface-raised" />
            {t('relations.legendSource')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded-sm border border-accent bg-accent-soft" />
            {t('relations.legendTarget')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded-sm border border-danger bg-danger-soft" />
            {t('relations.legendProblem')}
          </span>
          <Button size="sm" variant="ghost" onClick={() => fitView({ padding: 0.2 })}>
            {t('relations.fitView')}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <EdgeClickContext.Provider value={openLink}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) =>
                (n.data as { kind?: string }).kind === 'target' ? 'var(--accent)' : 'var(--border-strong)'
              }
            />
          </ReactFlow>
        </EdgeClickContext.Provider>
      </div>
      <section
        className={cn(
          'border-t border-border bg-surface-raised',
          issuesOpen ? 'max-h-[40%] overflow-auto' : '',
        )}
        aria-label={t('relations.issues')}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold"
          onClick={() => setIssuesOpen(!issuesOpen)}
          aria-expanded={issuesOpen}
        >
          {issuesOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          {t('relations.issues')}
          <span
            className={cn(
              'rounded-full px-1.5 text-[11px]',
              diagnostics.length > 0 ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success',
            )}
          >
            {diagnostics.length}
          </span>
        </button>
        {issuesOpen ? (
          <div className="px-3 pb-3">
            {diagnostics.length === 0 ? (
              <p className="text-xs text-fg-muted">{t('relations.noIssues')}</p>
            ) : (
              <DiagnosticList items={diagnostics} compact />
            )}
          </div>
        ) : null}
      </section>
      <LinkDialog link={dialogLink} open={dialogLink !== null} onClose={() => setDialogLink(null)} />
    </div>
  );
}

export function RelationsCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
