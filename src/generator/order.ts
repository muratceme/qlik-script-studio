/**
 * Dependency ordering. Everything is deterministic: ties are broken by the
 * position of the item in the project arrays.
 */
import type { Link, SourceTable, TargetTable } from '@/model/types';
import type { Context } from './context';
import { MERGE_TYPES } from './plan';
import { KEEP_TYPES } from './context';

export type OrderResult<T> = { ok: true; items: T[] } | { ok: false; cycle: T[] };

/**
 * Kahn's algorithm with a stable ready queue. `deps(node)` returns the ids the
 * node must come after. Unknown ids are ignored.
 */
export function topoSort<T extends { id: string }>(nodes: T[], deps: (node: T) => string[]): OrderResult<T> {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const remaining = new Map<string, Set<string>>();
  for (const n of nodes) {
    remaining.set(n.id, new Set(deps(n).filter((d) => index.has(d) && d !== n.id)));
  }
  const out: T[] = [];
  const done = new Set<string>();
  while (out.length < nodes.length) {
    const ready = nodes.filter((n) => !done.has(n.id) && [...remaining.get(n.id)!].every((d) => done.has(d)));
    const next = ready[0];
    if (!next) {
      const cycle = nodes.filter((n) => !done.has(n.id));
      return { ok: false, cycle };
    }
    out.push(next);
    done.add(next.id);
  }
  return { ok: true, items: out };
}

/** Sources that feed MAPPING LOADs must be loaded before the tables that use the map. */
export function orderSources(ctx: Context): OrderResult<SourceTable> {
  return topoSort(ctx.project.sources, (s) =>
    ctx.project.links
      .filter((l) => l.type === 'applyMap' && l.leftTableId === s.id)
      .map((l) => l.rightTableId),
  );
}

export type TransformNode =
  { id: string; kind: 'target'; target: TargetTable } | { id: string; kind: 'link'; link: Link };

/** Links that produce a statement in the Transform section. */
export function isTransformLink(link: Link): boolean {
  return MERGE_TYPES.has(link.type) || KEEP_TYPES.has(link.type);
}

export function orderTransform(ctx: Context): OrderResult<TransformNode> {
  const nodes: TransformNode[] = [
    ...ctx.project.targets.map((t): TransformNode => ({ id: `T:${t.id}`, kind: 'target', target: t })),
    ...ctx.project.links
      .filter(isTransformLink)
      .map((l): TransformNode => ({ id: `L:${l.id}`, kind: 'link', link: l })),
  ];
  return topoSort(nodes, (node) => {
    if (node.kind === 'link') {
      const deps: string[] = [];
      if (ctx.targets.has(node.link.leftTableId)) deps.push(`T:${node.link.leftTableId}`);
      if (ctx.targets.has(node.link.rightTableId)) deps.push(`T:${node.link.rightTableId}`);
      return deps;
    }
    const deps: string[] = [];
    const primary = node.target.primarySourceId;
    if (primary && ctx.targets.has(primary)) deps.push(`T:${primary}`);
    // Merges into the primary table must happen before this target reads it,
    // unless the merge brings this very target into the primary.
    for (const l of ctx.project.links) {
      if (!isTransformLink(l)) continue;
      if (l.leftTableId === primary && l.rightTableId !== node.target.id) deps.push(`L:${l.id}`);
    }
    return deps;
  });
}
