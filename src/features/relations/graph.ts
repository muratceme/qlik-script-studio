/**
 * Turns the project into React Flow nodes and edges. Pure helpers, so they can
 * be unit tested without rendering.
 */
import type { Edge, Node } from '@xyflow/react';
import type { Diagnostic } from '@/generator';
import { buildContext, ownFieldNames } from '@/generator/context';
import { survivingTableIds } from '@/generator/plan';
import type { Link, LinkType, Project } from '@/model/types';
import { isSourceTable } from '@/model/types';

export interface TableNodeData extends Record<string, unknown> {
  tableId: string;
  name: string;
  kind: 'source' | 'target';
  sourceKind: string | null;
  fields: { id: string; name: string; role: string }[];
  problem: boolean;
}

export type TableNode = Node<TableNodeData, 'table'>;

export interface LinkEdgeData extends Record<string, unknown> {
  linkId: string | null;
  type: LinkType | 'implicit';
  label: string;
  problem: boolean;
}

export type LinkEdge = Edge<LinkEdgeData, 'link'>;

export const NODE_WIDTH = 240;
const NODE_GAP_X = 320;
const NODE_GAP_Y = 40;
const ROW_HEIGHT = 26;
const HEADER_HEIGHT = 44;

export function nodeHeight(fieldCount: number): number {
  return HEADER_HEIGHT + Math.max(1, fieldCount) * ROW_HEIGHT + 12;
}

/** Sources in the first column, targets in the second; stacked vertically. */
export function autoPosition(project: Project, tableId: string): { x: number; y: number } {
  const stored = project.canvas.positions[tableId];
  if (stored) return stored;
  const sources = project.sources;
  const targets = project.targets;
  const sIndex = sources.findIndex((s) => s.id === tableId);
  if (sIndex >= 0) {
    let y = 40;
    for (let i = 0; i < sIndex; i++)
      y += nodeHeight(sources[i]!.fields.filter((f) => f.role !== 'ignore').length) + NODE_GAP_Y;
    return { x: 40, y };
  }
  const tIndex = targets.findIndex((t) => t.id === tableId);
  let y = 40;
  for (let i = 0; i < tIndex; i++) y += nodeHeight(targets[i]!.columns.length) + NODE_GAP_Y;
  return { x: 40 + NODE_GAP_X + NODE_WIDTH, y };
}

export function handleId(tableId: string, fieldId: string): string {
  return `${tableId}::${fieldId}`;
}

export function parseHandleId(id: string | null | undefined): { tableId: string; fieldId: string } | null {
  if (!id) return null;
  const [tableId, fieldId] = id.split('::');
  return tableId && fieldId ? { tableId, fieldId } : null;
}

export function buildNodes(project: Project, diagnostics: Diagnostic[]): TableNode[] {
  const ctx = buildContext(project);
  const problemTables = new Set(diagnostics.flatMap((d) => d.refs.tableIds ?? []));
  const nodes: TableNode[] = [];
  for (const table of [...project.sources, ...project.targets]) {
    const fields = isSourceTable(table)
      ? table.fields
          .filter((f) => f.role !== 'ignore')
          .map((f) => ({ id: f.id, name: ctx.outName({ tableId: table.id, fieldId: f.id }), role: f.role }))
      : table.columns.map((c) => ({
          id: c.id,
          name: ctx.columnName(c),
          role:
            c.kind === 'measure'
              ? 'measure'
              : c.kind === 'calculated'
                ? 'dimension'
                : (ctx.field(c.ref)?.role ?? 'dimension'),
        }));
    nodes.push({
      id: table.id,
      type: 'table',
      position: autoPosition(project, table.id),
      data: {
        tableId: table.id,
        name: table.name,
        kind: isSourceTable(table) ? 'source' : 'target',
        sourceKind: isSourceTable(table) ? table.kind : null,
        fields,
        problem: problemTables.has(table.id),
      },
    });
  }
  return nodes;
}

const TYPE_LABEL: Record<LinkType, string> = {
  association: 'assoc',
  leftJoin: 'LEFT JOIN',
  rightJoin: 'RIGHT JOIN',
  innerJoin: 'INNER JOIN',
  outerJoin: 'OUTER JOIN',
  leftKeep: 'LEFT KEEP',
  rightKeep: 'RIGHT KEEP',
  innerKeep: 'INNER KEEP',
  concatenate: 'CONCATENATE',
  noConcatenate: 'NoConcatenate',
  applyMap: 'ApplyMap',
};

export function linkLabel(link: Link): string {
  return TYPE_LABEL[link.type];
}

export function buildEdges(project: Project, diagnostics: Diagnostic[]): LinkEdge[] {
  const ctx = buildContext(project);
  const problemLinks = new Set(diagnostics.flatMap((d) => d.refs.linkIds ?? []));
  const edges: LinkEdge[] = [];
  const covered = new Set<string>();

  for (const link of project.links) {
    const first = link.pairs[0];
    const applyMapPair =
      link.type === 'applyMap' && link.applyMap
        ? { leftFieldId: first?.leftFieldId ?? '', rightFieldId: link.applyMap.keyFieldId }
        : null;
    const pair = applyMapPair ?? first;
    covered.add([link.leftTableId, link.rightTableId].sort().join('|'));
    edges.push({
      id: `link:${link.id}`,
      type: 'link',
      // Edges are drawn from the right table (merged in) to the left table (merged into).
      source: link.rightTableId,
      target: link.leftTableId,
      sourceHandle: pair ? handleId(link.rightTableId, pair.rightFieldId) : undefined,
      targetHandle: pair ? handleId(link.leftTableId, pair.leftFieldId) : undefined,
      data: { linkId: link.id, type: link.type, label: linkLabel(link), problem: problemLinks.has(link.id) },
    });
  }

  // Implicit associations: surviving tables that share a field name without a link.
  const surviving = new Set(survivingTableIds(ctx));
  const tables = [...project.sources, ...project.targets].filter((t) => surviving.has(t.id));
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const a = tables[i]!;
      const b = tables[j]!;
      if (covered.has([a.id, b.id].sort().join('|'))) continue;
      const namesA = ownFieldNames(ctx, a.id);
      const namesB = new Set(ownFieldNames(ctx, b.id));
      const shared = namesA.filter((n) => namesB.has(n));
      if (shared.length === 0) continue;
      const fieldA = fieldIdByName(project, a.id, shared[0]!);
      const fieldB = fieldIdByName(project, b.id, shared[0]!);
      edges.push({
        id: `implicit:${a.id}:${b.id}`,
        type: 'link',
        source: a.id,
        target: b.id,
        sourceHandle: fieldA ? handleId(a.id, fieldA) : undefined,
        targetHandle: fieldB ? handleId(b.id, fieldB) : undefined,
        data: { linkId: null, type: 'implicit', label: shared.join(', '), problem: shared.length > 1 },
      });
    }
  }
  return edges;
}

function fieldIdByName(project: Project, tableId: string, name: string): string | undefined {
  const ctx = buildContext(project);
  const source = project.sources.find((s) => s.id === tableId);
  if (source)
    return source.fields.find((f) => f.role !== 'ignore' && ctx.outName({ tableId, fieldId: f.id }) === name)
      ?.id;
  const target = project.targets.find((t) => t.id === tableId);
  return target?.columns.find((c) => ctx.columnName(c) === name)?.id;
}
