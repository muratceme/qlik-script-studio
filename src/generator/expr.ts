/**
 * Renders the expression and condition trees to Qlik expression text.
 */
import type { Condition, ConditionGroup, DatePart, Expr, FieldRef } from '@/model/types';
import type { Context } from './context';
import { qName, qNum, qStr } from './quote';

export interface ExprScope {
  /** Resolves a field reference to the name usable in the current LOAD. */
  fieldName: (ref: FieldRef) => string;
  /** Resolves an applyMap link to `ApplyMap(...)` text; undefined when the link is unknown. */
  applyMap: (linkId: string, key: string) => string | undefined;
}

export function defaultScope(ctx: Context): ExprScope {
  return {
    fieldName: (ref) => ctx.outName(ref),
    applyMap: (linkId, key) => {
      const link = ctx.links.get(linkId);
      if (!link || link.type !== 'applyMap' || !link.applyMap) return undefined;
      const def = link.applyMap.defaultValue;
      return def === null
        ? `ApplyMap(${qStr(link.applyMap.mapName)}, ${key})`
        : `ApplyMap(${qStr(link.applyMap.mapName)}, ${key}, ${qStr(def)})`;
    },
  };
}

export function renderLiteral(value: string | number): string {
  return typeof value === 'number' ? qNum(value) : qStr(value);
}

export function renderExpr(expr: Expr, scope: ExprScope): string {
  switch (expr.kind) {
    case 'field':
      return qName(scope.fieldName(expr.ref));
    case 'literal':
      return renderLiteral(expr.value);
    case 'concat': {
      const parts = expr.parts.map((p) => renderExpr(p, scope));
      if (parts.length === 0) return "''";
      const sep = expr.separator ? ` & ${qStr(expr.separator)} & ` : ' & ';
      return parts.join(sep);
    }
    case 'arith': {
      const left = renderExpr(expr.left, scope);
      const right = renderExpr(expr.right, scope);
      if (expr.op === '/' && expr.safeDivide) {
        return `If(${right} <> 0, ${left} / ${right})`;
      }
      return `(${left} ${expr.op} ${right})`;
    }
    case 'percent':
      return `${renderExpr(expr.part, scope)} / ${renderExpr(expr.whole, scope)} * 100`;
    case 'if': {
      const cond = renderGroup(expr.condition, scope, true) || '1 = 1';
      const then = renderExpr(expr.then, scope);
      return expr.else ? `If(${cond}, ${then}, ${renderExpr(expr.else, scope)})` : `If(${cond}, ${then})`;
    }
    case 'datePart':
      return renderDatePart(expr.part, renderExpr(expr.of, scope));
    case 'applyMap': {
      const key = renderExpr(expr.key, scope);
      return scope.applyMap(expr.linkId, key) ?? key;
    }
    case 'autoNumber': {
      const of = renderExpr(expr.of, scope);
      return expr.counterName ? `AutoNumber(${of}, ${qStr(expr.counterName)})` : `AutoNumber(${of})`;
    }
    case 'raw':
      return expr.text.trim();
  }
}

export function renderDatePart(part: DatePart, of: string): string {
  switch (part) {
    case 'year':
      return `Year(${of})`;
    case 'quarter':
      return `'Q' & Ceil(Month(${of}) / 3)`;
    case 'month':
      return `Month(${of})`;
    case 'monthName':
      return `MonthName(${of})`;
    case 'week':
      return `Week(${of})`;
    case 'day':
      return `Day(${of})`;
    case 'weekday':
      return `WeekDay(${of})`;
    case 'yearMonth':
      return `Date(MonthStart(${of}), 'YYYY-MM')`;
  }
}

export function renderCondition(cond: Condition, scope: ExprScope): string {
  const left = renderExpr(cond.left, scope);
  const values = cond.values.map(renderLiteral);
  const first = values[0] ?? "''";
  switch (cond.op) {
    case 'eq':
      return `${left} = ${first}`;
    case 'neq':
      return `${left} <> ${first}`;
    case 'gt':
      return `${left} > ${first}`;
    case 'gte':
      return `${left} >= ${first}`;
    case 'lt':
      return `${left} < ${first}`;
    case 'lte':
      return `${left} <= ${first}`;
    case 'in':
      return `Match(${left}, ${values.join(', ')}) > 0`;
    case 'notIn':
      return `Match(${left}, ${values.join(', ')}) = 0`;
    case 'contains':
      return `Index(${left}, ${first}) > 0`;
    case 'startsWith': {
      const raw = cond.values[0];
      const pattern = typeof raw === 'string' ? qStr(`${raw}*`) : `${first} & '*'`;
      return `WildMatch(${left}, ${pattern}) > 0`;
    }
    case 'isNull':
      return `Len(Trim(${left})) = 0`;
    case 'isNotNull':
      return `Len(Trim(${left})) > 0`;
    case 'between': {
      const second = values[1] ?? first;
      return `${left} >= ${first} AND ${left} <= ${second}`;
    }
  }
}

/**
 * Renders a condition group. The outermost group is not wrapped in
 * parentheses; nested groups and `between` conditions inside a group are.
 * Returns an empty string for an empty group.
 */
export function renderGroup(group: ConditionGroup, scope: ExprScope, outermost: boolean): string {
  const parts: string[] = [];
  for (const item of group.items) {
    if (item.kind === 'group') {
      const inner = renderGroup(item, scope, false);
      if (inner) parts.push(inner);
    } else {
      const text = renderCondition(item, scope);
      parts.push(item.op === 'between' && group.items.length > 1 ? `(${text})` : text);
    }
  }
  if (parts.length === 0) return '';
  const joined = parts.join(group.logic === 'and' ? ' AND ' : ' OR ');
  return outermost || parts.length === 1 ? joined : `(${joined})`;
}
