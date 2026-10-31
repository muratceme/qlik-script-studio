import type { Context } from '../context';
import { joinPath, qPath, qTable } from '../quote';
import type { ScriptWriter } from '../writer';

export function storePath(ctx: Context, name: string, path: string): string {
  if (path.trim()) return path.trim();
  return joinPath(ctx.project.settings.qvdStorePath || null, `${name}.qvd`);
}

export function emitStores(ctx: Context, w: ScriptWriter): void {
  for (const target of ctx.project.targets) {
    if (!target.store.enabled) continue;
    w.comment(`Store ${target.name} as QVD`);
    w.line(`STORE ${qTable(target.name)} INTO ${qPath(storePath(ctx, target.name, target.store.path))} (qvd);`);
  }
}
