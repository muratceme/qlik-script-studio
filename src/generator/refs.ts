/** Walks expression / condition trees and collects field references. */
import type { ConditionGroup, Expr, FieldRef, TargetTable } from '@/model/types';

export function exprRefs(expr: Expr, out: FieldRef[] = []): FieldRef[] {
  switch (expr.kind) {
    case 'field':
      out.push(expr.ref);
      break;
    case 'literal':
    case 'raw':
      break;
    case 'concat':
      for (const p of expr.parts) exprRefs(p, out);
      break;
    case 'arith':
      exprRefs(expr.left, out);
      exprRefs(expr.right, out);
      break;
    case 'percent':
      exprRefs(expr.part, out);
      exprRefs(expr.whole, out);
      break;
    case 'if':
      groupRefs(expr.condition, out);
      exprRefs(expr.then, out);
      if (expr.else) exprRefs(expr.else, out);
      break;
    case 'datePart':
    case 'autoNumber':
      exprRefs(expr.of, out);
      break;
    case 'applyMap':
      exprRefs(expr.key, out);
      break;
  }
  return out;
}

export function groupRefs(group: ConditionGroup, out: FieldRef[] = []): FieldRef[] {
  for (const item of group.items) {
    if (item.kind === 'group') groupRefs(item, out);
    else exprRefs(item.left, out);
  }
  return out;
}

export function targetRefs(target: TargetTable): FieldRef[] {
  const out: FieldRef[] = [];
  for (const c of target.columns) {
    if (c.kind === 'calculated') exprRefs(c.expr, out);
    else out.push(c.ref);
  }
  if (target.filter) groupRefs(target.filter, out);
  return out;
}

export function exprHasEmptyRaw(expr: Expr): boolean {
  switch (expr.kind) {
    case 'raw':
      return expr.text.trim().length === 0;
    case 'field':
    case 'literal':
      return false;
    case 'concat':
      return expr.parts.some(exprHasEmptyRaw);
    case 'arith':
      return exprHasEmptyRaw(expr.left) || exprHasEmptyRaw(expr.right);
    case 'percent':
      return exprHasEmptyRaw(expr.part) || exprHasEmptyRaw(expr.whole);
    case 'if':
      return exprHasEmptyRaw(expr.then) || (expr.else ? exprHasEmptyRaw(expr.else) : false);
    case 'datePart':
    case 'autoNumber':
      return exprHasEmptyRaw(expr.of);
    case 'applyMap':
      return exprHasEmptyRaw(expr.key);
  }
}
