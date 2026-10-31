import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import type { CompositeKeyMode, Link, LinkType } from '@/model/types';
import { LINK_TYPES, isSourceTable } from '@/model/types';
import { Button, Checkbox, Dialog, IconButton, Labeled, Select, TextInput } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { removeLink, replaceLink } from '@/store/linkActions';
import { buildContext } from '@/generator/context';

export function LinkDialog({ link, open, onClose }: { link: Link | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const project = useProjectStore((s) => s.project);
  const [draft, setDraft] = useState<Link | null>(link);
  const isNew = link ? !project.links.some((l) => l.id === link.id) : false;

  useEffect(() => {
    setDraft(link ? structuredClone(link) : null);
  }, [link, open]);

  if (!draft) return null;
  const ctx = buildContext(project);
  const fieldsOf = (tableId: string) => {
    const table = ctx.table(tableId);
    if (!table) return [];
    return isSourceTable(table)
      ? table.fields.filter((f) => f.role !== 'ignore').map((f) => ({ value: f.id, label: ctx.outName({ tableId, fieldId: f.id }) }))
      : table.columns.map((c) => ({ value: c.id, label: ctx.columnName(c) }));
  };
  const leftName = ctx.tableName(draft.leftTableId);
  const rightName = ctx.tableName(draft.rightTableId);
  const leftFields = fieldsOf(draft.leftTableId);
  const rightFields = fieldsOf(draft.rightTableId);
  const needsPairs = draft.type !== 'concatenate' && draft.type !== 'noConcatenate';
  const isMerge = draft.type !== 'association' && draft.type !== 'noConcatenate' && draft.type !== 'applyMap';

  const swap = () =>
    setDraft({
      ...draft,
      leftTableId: draft.rightTableId,
      rightTableId: draft.leftTableId,
      pairs: draft.pairs.map((p) => ({ leftFieldId: p.rightFieldId, rightFieldId: p.leftFieldId })),
      applyMap: null,
    });

  const setType = (type: LinkType) => {
    const next: Link = { ...draft, type };
    if (type === 'applyMap' && !next.applyMap) {
      const key = draft.pairs[0]?.rightFieldId ?? rightFields[0]?.value ?? '';
      const value = rightFields.find((f) => f.value !== key)?.value ?? '';
      next.applyMap = { keyFieldId: key, valueFieldId: value, defaultValue: null, mapName: `Map_${rightName}`, outputName: rightFields.find((f) => f.value === value)?.label ?? 'Mapped' };
      if (next.pairs.length === 0 && leftFields[0]) next.pairs = [{ leftFieldId: leftFields[0].value, rightFieldId: key }];
    }
    setDraft(next);
  };

  const save = () => {
    replaceLink(draft);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isNew ? t('relations.newLink') : t('relations.editLink')}
      footer={
        <>
          {!isNew ? (
            <Button variant="danger" icon={<Trash2 />} onClick={() => (removeLink(draft.id), onClose())} className="mr-auto">
              {t('relations.deleteLink')}
            </Button>
          ) : null}
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={save} disabled={needsPairs && draft.pairs.length === 0}>
            {isNew ? t('common.add') : t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Labeled label={t('relations.linkType')} hint={t(`linkTypeHints.${draft.type}`)}>
          {(id) => <Select id={id} value={draft.type} onChange={(e) => setType(e.target.value as LinkType)} options={LINK_TYPES.map((lt) => ({ value: lt, label: t(`linkTypes.${lt}`) }))} />}
        </Labeled>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised p-3 text-sm">
          <div className="flex-1">
            <p className="text-xs text-fg-muted">{isMerge ? t('relations.direction') : t('common.table')}</p>
            <p className="font-semibold">{leftName}</p>
          </div>
          <IconButton label={t('relations.directionHint')} onClick={swap} disabled={draft.type === 'applyMap'}>
            <ArrowLeftRight />
          </IconButton>
          <div className="flex-1 text-right">
            <p className="text-xs text-fg-muted">{draft.type === 'applyMap' ? t('formula.mapping') : t('common.table')}</p>
            <p className="font-semibold">{rightName}</p>
          </div>
        </div>
        {isMerge ? <p className="-mt-2 text-xs text-fg-subtle">{t('relations.directionHint')}</p> : null}

        {needsPairs ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t('relations.pairs')}</h4>
              {draft.type !== 'applyMap' ? (
                <Button
                  size="sm"
                  icon={<Plus />}
                  className="ml-auto"
                  onClick={() => setDraft({ ...draft, pairs: [...draft.pairs, { leftFieldId: leftFields[0]?.value ?? '', rightFieldId: rightFields[0]?.value ?? '' }] })}
                >
                  {t('relations.addPair')}
                </Button>
              ) : null}
            </div>
            {draft.pairs.map((pair, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                <Select aria-label={leftName} className="!h-8 !text-xs" value={pair.leftFieldId} onChange={(e) => setDraft({ ...draft, pairs: draft.pairs.map((p, j) => (j === i ? { ...p, leftFieldId: e.target.value } : p)) })} options={leftFields} />
                <span className="text-xs text-fg-subtle">=</span>
                <Select
                  aria-label={rightName}
                  className="!h-8 !text-xs"
                  value={draft.type === 'applyMap' && draft.applyMap ? draft.applyMap.keyFieldId : pair.rightFieldId}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      pairs: draft.pairs.map((p, j) => (j === i ? { ...p, rightFieldId: e.target.value } : p)),
                      applyMap: draft.applyMap ? { ...draft.applyMap, keyFieldId: e.target.value } : null,
                    })
                  }
                  options={rightFields}
                />
                <IconButton label={t('common.remove')} size="sm" variant="danger" disabled={draft.type === 'applyMap'} onClick={() => setDraft({ ...draft, pairs: draft.pairs.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            ))}
          </div>
        ) : null}

        {draft.type === 'association' ? (
          <Checkbox label={t('relations.renameRightToLeft')} checked={draft.renameRightToLeft} onChange={(e) => setDraft({ ...draft, renameRightToLeft: e.target.checked })} />
        ) : null}

        {draft.pairs.length >= 2 && draft.type !== 'applyMap' && draft.type !== 'concatenate' ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <Checkbox
              label={t('relations.compositeKey')}
              hint={t('relations.compositeKeyHint')}
              checked={draft.compositeKey !== null}
              onChange={(e) => setDraft({ ...draft, compositeKey: e.target.checked ? { mode: 'autoNumber', name: '%Key', separator: '|' } : null })}
            />
            {draft.compositeKey ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Labeled label={t('common.type')}>
                  {(id) => (
                    <Select
                      id={id}
                      className="!h-8 !text-xs"
                      value={draft.compositeKey!.mode}
                      onChange={(e) => setDraft({ ...draft, compositeKey: { ...draft.compositeKey!, mode: e.target.value as CompositeKeyMode } })}
                      options={[
                        { value: 'autoNumber', label: t('relations.compositeAutoNumber') },
                        { value: 'concat', label: t('relations.compositeConcat') },
                      ]}
                    />
                  )}
                </Labeled>
                <Labeled label={t('relations.compositeName')}>
                  {(id) => <TextInput id={id} className="!h-8" value={draft.compositeKey!.name} onChange={(e) => setDraft({ ...draft, compositeKey: { ...draft.compositeKey!, name: e.target.value } })} />}
                </Labeled>
                <Labeled label={t('relations.separator')}>
                  {(id) => <TextInput id={id} className="!h-8" value={draft.compositeKey!.separator} onChange={(e) => setDraft({ ...draft, compositeKey: { ...draft.compositeKey!, separator: e.target.value } })} />}
                </Labeled>
              </div>
            ) : null}
          </div>
        ) : null}

        {draft.type === 'applyMap' && draft.applyMap ? (
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <Labeled label={t('relations.mapValue')}>
              {(id) => <Select id={id} className="!h-8 !text-xs" value={draft.applyMap!.valueFieldId} onChange={(e) => setDraft({ ...draft, applyMap: { ...draft.applyMap!, valueFieldId: e.target.value } })} options={rightFields} />}
            </Labeled>
            <Labeled label={t('relations.mapOutput')}>
              {(id) => <TextInput id={id} className="!h-8" value={draft.applyMap!.outputName} onChange={(e) => setDraft({ ...draft, applyMap: { ...draft.applyMap!, outputName: e.target.value } })} />}
            </Labeled>
            <Labeled label={t('relations.mapName')}>
              {(id) => <TextInput id={id} className="!h-8" value={draft.applyMap!.mapName} onChange={(e) => setDraft({ ...draft, applyMap: { ...draft.applyMap!, mapName: e.target.value } })} />}
            </Labeled>
            <Labeled label={`${t('relations.mapDefault')} (${t('common.optional')})`}>
              {(id) => <TextInput id={id} className="!h-8" value={draft.applyMap!.defaultValue ?? ''} onChange={(e) => setDraft({ ...draft, applyMap: { ...draft.applyMap!, defaultValue: e.target.value || null } })} />}
            </Labeled>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
