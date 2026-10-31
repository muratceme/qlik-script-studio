import { parseProject } from './schema';
import type { Project } from './types';

/**
 * Brings a persisted or imported project up to the current schema. Returns
 * null when the data cannot be understood.
 *
 * Add a step here whenever SCHEMA_VERSION changes.
 */
export function migrateProject(input: unknown): Project | null {
  if (!input || typeof input !== 'object') return null;
  const data = { ...(input as Record<string, unknown>) };

  // Pre-release projects without a version are treated as version 1.
  if (data.schemaVersion === undefined) data.schemaVersion = 1;

  const result = parseProject(data);
  return result.ok ? result.project : null;
}
