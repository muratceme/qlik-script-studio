/**
 * Public API of the generator.
 *
 *   validateModel(project)  -> errors that block generation
 *   analyzeModel(project)   -> warnings about the resulting data model
 *   buildScript(project)    -> { script | null, errors, warnings }
 *   generateScript(project) -> script string (throws on errors)
 *
 * Pure and deterministic: no I/O, no clock, no randomness.
 */
import type { Project } from '@/model/types';
import { analyzeWithContext } from './analyze';
import { buildContext } from './context';
import type { Diagnostic } from './diagnostics';
import { emitCalendar } from './emit/calendar';
import { emitCleanup } from './emit/cleanup';
import { emitLink } from './emit/link';
import { emitSettings } from './emit/settings';
import { emitMappingsFor, emitSource } from './emit/source';
import { emitStores } from './emit/store';
import { emitTarget } from './emit/target';
import { orderSources, orderTransform } from './order';
import { validateWithContext } from './validate';
import { ScriptWriter } from './writer';

export type { Diagnostic, DiagnosticCode, ErrorCode, WarningCode, Fix } from './diagnostics';
export { analyzeModel } from './analyze';
export { validateModel } from './validate';

export interface GenerateResult {
  script: string | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

export class ModelValidationError extends Error {
  constructor(public readonly errors: Diagnostic[]) {
    super(`Model has ${errors.length} validation error(s): ${errors.map((e) => e.code).join(', ')}`);
    this.name = 'ModelValidationError';
  }
}

/**
 * Targets without columns are usually tables the user has just created. They
 * are left out of the script (with a warning) instead of blocking it.
 */
function withoutEmptyTargets(project: Project): { project: Project; skipped: Diagnostic[] } {
  const empty = project.targets.filter((t) => t.columns.length === 0);
  if (empty.length === 0) return { project, skipped: [] };
  const ids = new Set(empty.map((t) => t.id));
  const pruned: Project = {
    ...project,
    targets: project.targets.filter((t) => !ids.has(t.id)),
    links: project.links.filter((l) => !ids.has(l.leftTableId) && !ids.has(l.rightTableId)),
    calendar:
      project.calendar && project.calendar.dateField && ids.has(project.calendar.dateField.tableId)
        ? { ...project.calendar, enabled: false }
        : project.calendar,
  };
  const skipped = empty.map((t): Diagnostic => ({
    severity: 'warning',
    code: 'TARGET_NO_COLUMNS',
    params: { table: t.name },
    refs: { tableIds: [t.id], targetIds: [t.id] },
    fixes: [],
  }));
  return { project: pruned, skipped };
}

export function buildScript(input: Project): GenerateResult {
  const { project, skipped } = withoutEmptyTargets(input);
  const ctx = buildContext(project);
  const errors = validateWithContext(ctx);
  if (errors.length > 0) return { script: null, errors, warnings: skipped };
  const warnings = [...skipped, ...analyzeWithContext(ctx)];

  const w = new ScriptWriter();
  emitSettings(ctx, w);

  w.section('Sources');
  const sources = orderSources(ctx);
  if (sources.ok) {
    const state = { connectionId: null as string | null };
    for (const source of sources.items) {
      emitSource(ctx, w, source, state);
      emitMappingsFor(ctx, w, source.id);
    }
  }

  w.section('Transform');
  const transform = orderTransform(ctx);
  if (transform.ok) {
    for (const node of transform.items) {
      if (node.kind === 'target') {
        emitTarget(ctx, w, node.target);
        emitMappingsFor(ctx, w, node.target.id);
      } else {
        emitLink(ctx, w, node.link);
      }
    }
  }

  w.section('Calendar');
  emitCalendar(ctx, w);

  w.section('Store');
  emitStores(ctx, w);

  w.section('Cleanup');
  emitCleanup(ctx, w);

  return { script: w.render(project.settings.useTabs), errors, warnings };
}

export function generateScript(project: Project): string {
  const result = buildScript(project);
  if (result.script === null) throw new ModelValidationError(result.errors);
  return result.script;
}
