import { useTranslation } from 'react-i18next';
import { Copy, Plus, Trash2 } from 'lucide-react';
import type { SourceTable } from '@/model/types';
import { Button, IconButton } from '@/components/ui';
import { useUiStore } from '@/store/uiStore';
import { addSourceTable, duplicateSourceTable, removeSourceTable } from '@/store/sourceActions';
import { cn } from '@/lib/cn';
import { SourceKindIcon } from './SourceKindIcon';

export function SourceTableList({ sources, selectedId }: { sources: SourceTable[]; selectedId: string | null }) {
  const { t } = useTranslation();
  const select = useUiStore((s) => s.selectSource);
  return (
    <aside className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('sources.title')}</h2>
        <span className="text-xs text-fg-subtle">{t('sources.tableCount', { count: sources.length })}</span>
      </div>
      <ul className="flex flex-col gap-1" role="listbox" aria-label={t('sources.title')}>
        {sources.map((table) => (
          <li key={table.id}>
            <div
              role="option"
              aria-selected={table.id === selectedId}
              tabIndex={0}
              onClick={() => select(table.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  select(table.id);
                }
              }}
              className={cn(
                'group flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm',
                table.id === selectedId ? 'border-accent bg-accent-soft/50' : 'border-border bg-surface-raised hover:bg-surface-sunken',
              )}
            >
              <SourceKindIcon kind={table.kind} className="size-4 shrink-0 text-fg-muted" />
              <span className="min-w-0 flex-1 truncate font-medium">{table.name || '—'}</span>
              <span className="text-xs text-fg-subtle">{table.fields.length}</span>
              <span className="hidden gap-0.5 group-hover:flex group-focus-within:flex">
                <IconButton
                  label={t('sources.duplicateTable')}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateSourceTable(table.id);
                  }}
                >
                  <Copy className="size-3.5" />
                </IconButton>
                <IconButton
                  label={t('common.delete')}
                  size="sm"
                  variant="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(t('common.confirmDelete', { name: table.name }))) removeSourceTable(table.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <Button size="sm" icon={<Plus />} onClick={() => addSourceTable()}>
        {t('sources.addTable')}
      </Button>
    </aside>
  );
}
