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

export function buildScript(project: Project): GenerateResult {
  const ctx = buildContext(project);
  const errors = validateWithContext(ctx);
  if (errors.length > 0) return { script: null, errors, warnings: [] };
  const warnings = analyzeWithContext(ctx);

  const w = new ScriptWriter();
  emitSettings(ctx, w);

  w.section('Sources');
  const sources = orderSources(ctx);
  if (sources.ok) {
    for (const source of sources.items) {
      emitSource(ctx, w, source);
      emitMappingsFor(ctx, w, source.id);
    }
  }

  w.section('Transform');
  const transform = orderTransform(ctx);
  if (transform.ok) {
    for (const node of transform.items) {
      if (node.kind === 'target') emitTarget(ctx, w, node.target);
      else emitLink(ctx, w, node.link);
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
