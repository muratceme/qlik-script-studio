import type { Context } from '../context';
import { droppedTables } from '../plan';
import { qTable } from '../quote';
import type { ScriptWriter } from '../writer';

export function emitCleanup(ctx: Context, w: ScriptWriter): void {
  const dropped = droppedTables(ctx);
  if (dropped.length === 0) return;
  w.comment('Drop temporary tables that were only used to build the final model');
  for (const table of dropped) {
    w.line(`DROP TABLE ${qTable(table.name)};`);
  }
}
