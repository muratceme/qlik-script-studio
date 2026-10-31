import { newLink } from '@/model/defaults';
import type { Link, LinkType } from '@/model/types';
import { useProjectStore } from './projectStore';

const update = (recipe: Parameters<ReturnType<typeof useProjectStore.getState>['update']>[0]) =>
  useProjectStore.getState().update(recipe);

export function addLink(link: Link): void {
  update((p) => {
    p.links.push(link);
  });
}

export function createLink(type: LinkType, leftTableId: string, rightTableId: string, pairs: Link['pairs']): Link {
  const link = newLink(type, leftTableId, rightTableId);
  link.pairs = pairs;
  return link;
}

export function updateLink(id: string, recipe: (link: Link) => void): void {
  update((p) => {
    const link = p.links.find((l) => l.id === id);
    if (link) recipe(link);
  });
}

export function replaceLink(link: Link): void {
  update((p) => {
    const index = p.links.findIndex((l) => l.id === link.id);
    if (index >= 0) p.links[index] = link;
    else p.links.push(link);
  });
}

export function removeLink(id: string): void {
  update((p) => {
    p.links = p.links.filter((l) => l.id !== id);
    for (const t of p.targets) {
      t.columns = t.columns.filter((c) => !(c.kind === 'calculated' && c.expr.kind === 'applyMap' && c.expr.linkId === id));
    }
  });
}

export function setNodePosition(tableId: string, position: { x: number; y: number }): void {
  update((p) => {
    p.canvas.positions[tableId] = { x: Math.round(position.x), y: Math.round(position.y) };
  });
}
