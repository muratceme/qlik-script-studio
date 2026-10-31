import { newProject } from '@/model/defaults';
import { sampleProject } from '@/model/sample';
import { migrateProject } from '@/model/migrate';
import { parseProject } from '@/model/schema';
import type { Project } from '@/model/types';
import { resetHistory, useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { downloadText, safeFileName } from '@/lib/download';

function load(project: Project): void {
  useProjectStore.getState().replaceProject(project);
  resetHistory();
  const ui = useUiStore.getState();
  ui.selectSource(project.sources[0]?.id ?? null);
  ui.selectTarget(project.targets[0]?.id ?? null);
}

export function startNewProject(name: string): void {
  load(newProject(name));
  useUiStore.getState().setStep(1);
}

export function loadSampleProject(): void {
  load(sampleProject());
}

export function exportProject(): void {
  const project = useProjectStore.getState().project;
  downloadText(safeFileName(project.name, 'qlikstudio.json'), JSON.stringify(project, null, 2), 'application/json');
}

export type ImportResult = { ok: true } | { ok: false; issues: string[] };

export async function importProjectFile(file: File): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return { ok: false, issues: ['Not valid JSON'] };
  }
  const migrated = migrateProject(data);
  if (migrated) {
    load(migrated);
    return { ok: true };
  }
  const parsed = parseProject(data);
  return { ok: false, issues: parsed.ok ? [] : parsed.issues.slice(0, 10) };
}
