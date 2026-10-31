import type { Expr, Project, TargetTable } from '@/model/types';
import { buildContext } from '@/generator/context';
import { renderExpr } from '@/generator/expr';
import { targetScope } from '@/generator/emit/target';

/** Renders an expression the way it will appear in the target's LOAD. */
export function previewExpr(project: Project, target: TargetTable, expr: Expr): string {
  try {
    const ctx = buildContext(project);
    return renderExpr(expr, targetScope(ctx, target));
  } catch {
    return '…';
  }
}
