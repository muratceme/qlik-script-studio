import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import type { FieldPair, Link, LinkType } from '@/model/types';
import { isSourceTable } from '@/model/types';
import { newLink } from '@/model/defaults';
import { Button, Dialog, IconButton, Labeled, Select } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { addLink } from '@/store/linkActions';
import { buildContext } from '@/generator/context';
import { guessPairs } from './guessPairs';
import { LinkDialog } from './LinkDialog';
import { cn } from '@/lib/cn';

type Mode = 'join' | 'association' | 'concatenate';
const MODE_TYPE: Record<Mode, LinkType> = {
  join: 'leftJoin',
  association: 'association',
  concatenate: 'concatenate',
};

export interface ConnectTablesDialogProps {
  open: boolean;
  onClose: () => void;
  /** Table that keeps its rows (merge target). */
  leftTableId: string | null;
  /** Table being connected. */
  rightTableId: string | null;
  /** When true the two tables cannot be changed, only swapped. */
  lockTables?: boolean;
  onCreated?: (link: Link) => void;
}

/**
 * Plain-language dialog for linking two tables. Creates a link in the project;
 * the full LinkDialog is one click away for every other relationship type.
 */
export function ConnectTablesDialog({
  open,
  onClose,
  leftTableId,
  rightTableId,
  lockTables = false,
  onCreated,
}: ConnectTablesDialogProps) {
  const { t } = useTranslation();
  const project = useProjectStore((s) => s.project);
  const [left, setLeft] = useState<string | null>(leftTableId);
  const [right, setRight] = useState<string | null>(rightTableId);
  const [mode, setMode] = useState<Mode>('join');
  const [pairs, setPairs] = useState<FieldPair[]>([]);
  const [advanced, setAdvanced] = useState<Link | null>(null);

  const tables = [...project.sources, ...project.targets];

  useEffect(() => {
    if (!open) return;
    const l = leftTableId ?? tables[0]?.id ?? null;
    const r = rightTableId ?? tables.find((x) => x.id !== l)?.id ?? null;
    setLeft(l);
    setRight(r);
    setMode('join');
    setPairs(l && r ? guessPairs(project, l, r) : []);
    setAdvanced(null);
  }, [open, leftTableId, rightTableId]);

  useEffect(() => {
    if (open && left && right) setPairs(guessPairs(project, left, right));
  }, [left, right]);

  const ctx = buildContext(project);
  const fieldsOf = (tableId: string | null) => {
    const table = tableId ? ctx.table(tableId) : undefined;
    if (!table) return [];
    return isSourceTable(table)
      ? table.fields
          .filter((f) => f.role !== 'ignore')
          .map((f) => ({ value: f.id, label: ctx.outName({ tableId: table.id, fieldId: f.id }) }))
      : table.columns.map((c) => ({ value: c.id, label: ctx.columnName(c) }));
  };
  const leftName = left ? ctx.tableName(left) : '?';
  const rightName = right ? ctx.tableName(right) : '?';
  const leftFields = fieldsOf(left);
  const rightFields = fieldsOf(right);
  const needsPairs = mode !== 'concatenate';
  const canSave = left && right && left !== right && (!needsPairs || pairs.length > 0);

  const buildLink = (): Link | null => {
    if (!left || !right) return null;
    const link = newLink(MODE_TYPE[mode], left, right);
    link.pairs = needsPairs ? pairs : [];
    if (mode === 'association') {
      // Association works through a shared name; align the names when they differ.
      link.renameRightToLeft = pairs.some(
        (p) =>
          ctx.outName({ tableId: left, fieldId: p.leftFieldId }) !==
          ctx.outName({ tableId: right, fieldId: p.rightFieldId }),
      );
    }
    return link;
  };

  const save = () => {
    const link = buildLink();
    if (!link) return;
    // Fields used to match rows are keys; marking them avoids fan-out and synthetic-key noise.
    if (needsPairs) {
      useProjectStore.getState().update((p) => {
        for (const pair of link.pairs) {
          for (const table of p.sources) {
            for (const f of table.fields) {
              if ((f.id === pair.leftFieldId || f.id === pair.rightFieldId) && f.role === 'dimension')
                f.role = 'key';
            }
          }
        }
      });
    }
    addLink(link);
    onCreated?.(link);
    onClose();
  };

  const swap = () => {
    setLeft(right);
    setRight(left);
    setPairs(pairs.map((p) => ({ leftFieldId: p.rightFieldId, rightFieldId: p.leftFieldId })));
  };

  const tableOptions = tables.map((x) => ({ value: x.id, label: x.name }));

  const modes: { id: Mode; label: string; hint: string }[] = [
    {
      id: 'join',
      label: t('connect.join', { left: leftName }),
      hint: t('connect.joinHint', { left: leftName, right: rightName }),
    },
    { id: 'association', label: t('connect.association'), hint: t('connect.associationHint') },
    {
      id: 'concatenate',
      label: t('connect.concatenate', { left: leftName }),
      hint: t('connect.concatenateHint'),
    },
  ];

  return (
    <>
      <Dialog
        open={open && !advanced}
        onClose={onClose}
        title={t('connect.title')}
        footer={
          <>
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                const link = buildLink();
                if (link) setAdvanced(link);
              }}
              disabled={!left || !right}
            >
              {t('connect.advanced')}
            </Button>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={save} disabled={!canSave}>
              {t('connect.button')}
            </Button>
          </>
        }
      >
        {tables.length < 2 ? (
          <p className="text-sm text-fg-muted">{t('connect.noOtherTables')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Labeled label={t('connect.rowsFrom')}>
                {(id) => (
                  <Select
                    id={id}
                    value={left ?? ''}
                    disabled={lockTables}
                    onChange={(e) => setLeft(e.target.value)}
                    options={tableOptions}
                  />
                )}
              </Labeled>
              <IconButton label={t('connect.swap')} onClick={swap} className="mb-0.5">
                <ArrowLeftRight />
              </IconButton>
              <Labeled label={t('connect.other')}>
                {(id) => (
                  <Select
                    id={id}
                    value={right ?? ''}
                    disabled={lockTables}
                    onChange={(e) => setRight(e.target.value)}
                    options={tableOptions.filter((o) => o.value !== left)}
                  />
                )}
              </Labeled>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">
                {t('connect.how', { left: leftName, right: rightName })}
              </legend>
              {modes.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
                    mode === m.id
                      ? 'border-accent bg-accent-soft/40'
                      : 'border-border hover:bg-surface-raised',
                  )}
                >
                  <input
                    type="radio"
                    name="connect-mode"
                    className="mt-1 accent-accent"
                    checked={mode === m.id}
                    onChange={() => setMode(m.id)}
                  />
                  <span>
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-fg-muted">{m.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {needsPairs ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{t('connect.matchOn')}</p>
                {pairs.map((pair, i) => {
                  const ln = leftFields.find((f) => f.value === pair.leftFieldId)?.label;
                  const rn = rightFields.find((f) => f.value === pair.rightFieldId)?.label;
                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                        <Select
                          aria-label={leftName}
                          className="!h-8 !text-xs"
                          value={pair.leftFieldId}
                          onChange={(e) =>
                            setPairs(
                              pairs.map((p, j) => (j === i ? { ...p, leftFieldId: e.target.value } : p)),
                            )
                          }
                          options={leftFields}
                        />
                        <span className="text-xs text-fg-subtle">=</span>
                        <Select
                          aria-label={rightName}
                          className="!h-8 !text-xs"
                          value={pair.rightFieldId}
                          onChange={(e) =>
                            setPairs(
                              pairs.map((p, j) => (j === i ? { ...p, rightFieldId: e.target.value } : p)),
                            )
                          }
                          options={rightFields}
                        />
                        <IconButton
                          label={t('common.remove')}
                          size="sm"
                          variant="danger"
                          disabled={pairs.length <= 1}
                          onClick={() => setPairs(pairs.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </div>
                      {mode === 'association' && ln && rn && ln !== rn ? (
                        <p className="text-xs text-fg-subtle">{t('connect.sameName', { name: ln })}</p>
                      ) : null}
                    </div>
                  );
                })}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus />}
                  className="self-start"
                  onClick={() =>
                    setPairs([
                      ...pairs,
                      { leftFieldId: leftFields[0]?.value ?? '', rightFieldId: rightFields[0]?.value ?? '' },
                    ])
                  }
                >
                  {t('connect.addPair')}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Dialog>
      <LinkDialog
        link={advanced}
        open={advanced !== null}
        onClose={() => {
          const created = advanced
            ? useProjectStore.getState().project.links.find((l) => l.id === advanced.id)
            : undefined;
          setAdvanced(null);
          onClose();
          if (created) onCreated?.(created);
        }}
      />
    </>
  );
}
