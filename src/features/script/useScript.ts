import { useMemo } from 'react';
import { buildScript, type GenerateResult } from '@/generator';
import { useProjectStore } from '@/store/projectStore';

/** Live script for the current project. Recomputed only when the project changes. */
export function useScript(): GenerateResult {
  const project = useProjectStore((s) => s.project);
  return useMemo(() => buildScript(project), [project]);
}
