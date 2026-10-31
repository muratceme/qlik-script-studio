import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type { ArithOp, DatePart, Expr, TargetTable } from '@/model/types';
import { DATE_PARTS } from '@/model/types';
import { newConditionGroup } from '@/model/defaults';
import { Button, Checkbox, Dialog, IconButton, Labeled, Select, TextArea, TextInput } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { addCalculatedColumn, replaceColumn } from '@/store/targetActions';
import { useReachableFields, type ReachableField } from './useReachableFields';
import { OperandPicker } from './OperandPicker';
import { FilterBuilder } from './FilterBuilder';
import { previewExpr } from './exprPreview';

type Kind = Exclude<Expr['kind'], 'field' | 'literal'>;
const KINDS: Kind[] = ['concat', 'arith', 'percent', 'if', 'datePart', 'applyMap', 'autoNumber', 'raw'];

function firstField(fields: ReachableField[], predicate?: (f: ReachableField) => boolean): Expr {
  const found = (predicate ? fields.find(predicate) : undefined) ?? fields[0];
  return found ? { kind: 'field', ref: found.ref } : { kind: 'literal', value: '' };
}

function defaultExpr(kind: Kind, fields: ReachableField[], applyMapLinkId: string | null): Expr {
  switch (kind) {
    case 'concat':
      return { kind, parts: [firstField(fields), firstField(fields.slice(1))], separator: ' ' };
    case 'arith':
      return { kind, op: '*', left: firstField(fields), right: { kind: 'literal', value: 1 }, safeDivide: true };
    case 'percent':
      return { kind, part: firstField(fields), whole: firstField(fields.slice(1)) };
    case 'if':
      return { kind, condition: newConditionGroup('and'), then: { kind: 'literal', value: 'Yes' }, else: { kind: 'literal', value: 'No' } };
    case 'datePart':
      return { kind, part: 'year', of: firstField(fields, (f) => f.field.role === 'date' || f.field.dataType === 'date') };
    case 'applyMap':
      return { kind, linkId: applyMapLinkId ?? '', key: firstField(fields) };
    case 'autoNumber':
      return { kind, of: firstField(fields), counterName: null };
    case 'raw':
      return { kind, text: '' };
  }
}

export interface FormulaDialogProps {
  open: boolean;
  onClose: () => void;
  target: TargetTable;
  /** When set, the dialog edits this calculated column instead of adding one. */
  editColumnId?: string | null;
}

export function FormulaDialog({ open, onClose, target, editColumnId = null }: FormulaDialogProps) {
  const { t } = useTranslation();
  const project = useProjectStore((s) => s.project);
  const fields = useReachableFields(target);
  const mapLinks = project.links.filter((l) => l.type === 'applyMap' && l.applyMap);
  const editing = editColumnId ? target.columns.find((c) => c.id === editColumnId && c.kind === 'calculated') : undefined;

  const [kind, setKind] = useState<Kind>('concat');
  const [expr, setExpr] = useState<Expr>(() => defaultExpr('concat', fields, null));
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing && editing.kind === 'calculated') {
      const k = (editing.expr.kind === 'field' || editing.expr.kind === 'literal' ? 'raw' : editing.expr.kind) as Kind;
      setKind(k);
      setExpr(editing.expr);
      setName(editing.alias);
    } else {
      setKind('concat');
      setExpr(defaultExpr('concat', fields, mapLinks[0]?.id ?? null));
      setName('');
    }
  }, [open, editColumnId]);

  const preview = useMemo(() => previewExpr(project, target, expr), [project, target, expr]);

  const changeKind = (k: Kind) => {
    setKind(k);
    setExpr(defaultExpr(k, fields, mapLinks[0]?.id ?? null));
  };

  const submit = () => {
    if (!name.trim()) return;
    if (editing) replaceColumn(target.id, editing.id, { id: editing.id, kind: 'calculated', alias: name.trim(), expr });
    else addCalculatedColumn(target.id, name.trim(), expr);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('formula.title')}
      width="lg"
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim() || (expr.kind === 'raw' && !expr.text.trim())}>
            {editing ? t('common.save') : t('common.add')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labeled label={t('formula.operation')}>
            {(id) => <Select id={id} value={kind} onChange={(e) => changeKind(e.target.value as Kind)} options={KINDS.map((k) => ({ value: k, label: t(`exprKinds.${k}`) }))} />}
          </Labeled>
          <Labeled label={t('formula.outputName')}>
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="NewField" />}
          </Labeled>
        </div>

        <ExprEditor expr={expr} onChange={setExpr} fields={fields} mapLinks={mapLinks.map((l) => ({ id: l.id, name: l.applyMap!.mapName }))} />

        <div>
          <p className="mb-1 text-xs font-medium text-fg-muted">{t('formula.result')}</p>
          <pre className="overflow-x-auto rounded-md border border-border bg-surface-sunken p-2 font-mono text-xs">
            {preview} AS [{name || '…'}]
          </pre>
        </div>
      </div>
    </Dialog>
  );
}

function ExprEditor({
  expr,
  onChange,
  fields,
  mapLinks,
}: {
  expr: Expr;
  onChange: (e: Expr) => void;
  fields: ReachableField[];
  mapLinks: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  switch (expr.kind) {
    case 'concat':
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-fg-muted">{t('formula.parts')}</p>
          {expr.parts.map((part, i) => (
            <div key={i} className="flex items-end gap-1.5">
              <div className="flex-1">
                <OperandPicker label={`${i + 1}`} value={part} onChange={(p) => onChange({ ...expr, parts: expr.parts.map((x, j) => (j === i ? p : x)) })} fields={fields} />
              </div>
              <IconButton label={t('common.remove')} size="sm" variant="danger" disabled={expr.parts.length <= 1} onClick={() => onChange({ ...expr, parts: expr.parts.filter((_, j) => j !== i) })}>
                <Trash2 className="size-3.5" />
              </IconButton>
            </div>
          ))}
          <div className="flex items-end gap-3">
            <Button size="sm" icon={<Plus />} onClick={() => onChange({ ...expr, parts: [...expr.parts, { kind: 'literal', value: '' }] })}>
              {t('formula.add')}
            </Button>
            <Labeled label={t('formula.separator')} className="w-32">
              {(id) => <TextInput id={id} className="!h-8" value={expr.separator} onChange={(e) => onChange({ ...expr, separator: e.target.value })} />}
            </Labeled>
          </div>
        </div>
      );
    case 'arith':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <OperandPicker label={t('formula.left')} value={expr.left} onChange={(left) => onChange({ ...expr, left })} fields={fields} />
          <Labeled label={t('formula.operator')}>
            {(id) => (
              <Select
                id={id}
                className="!h-8 !w-36 !text-xs"
                value={expr.op}
                onChange={(e) => onChange({ ...expr, op: e.target.value as ArithOp })}
                options={[
                  { value: '+', label: t('formula.plus') },
                  { value: '-', label: t('formula.minus') },
                  { value: '*', label: t('formula.times') },
                  { value: '/', label: t('formula.divide') },
                ]}
              />
            )}
          </Labeled>
          <OperandPicker label={t('formula.right')} value={expr.right} onChange={(right) => onChange({ ...expr, right })} fields={fields} />
          {expr.op === '/' ? (
            <Checkbox className="sm:col-span-3" label={t('formula.safeDivide')} checked={expr.safeDivide} onChange={(e) => onChange({ ...expr, safeDivide: e.target.checked })} />
          ) : null}
        </div>
      );
    case 'percent':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OperandPicker label={t('formula.part')} value={expr.part} onChange={(part) => onChange({ ...expr, part })} fields={fields} />
          <OperandPicker label={t('formula.whole')} value={expr.whole} onChange={(whole) => onChange({ ...expr, whole })} fields={fields} />
        </div>
      );
    case 'if':
      return (
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-fg-muted">{t('formula.condition')}</p>
            <FilterBuilder group={expr.condition} onChange={(condition) => onChange({ ...expr, condition })} fields={fields} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OperandPicker label={t('formula.then')} value={expr.then} onChange={(then) => onChange({ ...expr, then })} fields={fields} />
            <OperandPicker label={t('formula.else')} value={expr.else ?? { kind: 'literal', value: '' }} onChange={(els) => onChange({ ...expr, else: els })} fields={fields} />
          </div>
        </div>
      );
    case 'datePart':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labeled label={t('formula.datePart')}>
            {(id) => <Select id={id} className="!h-8 !text-xs" value={expr.part} onChange={(e) => onChange({ ...expr, part: e.target.value as DatePart })} options={DATE_PARTS.map((p) => ({ value: p, label: t(`dateParts.${p}`) }))} />}
          </Labeled>
          <OperandPicker label={t('formula.dateField')} value={expr.of} onChange={(of) => onChange({ ...expr, of })} fields={fields} />
        </div>
      );
    case 'applyMap':
      return mapLinks.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('formula.noMappings')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labeled label={t('formula.mapping')}>
            {(id) => <Select id={id} className="!h-8 !text-xs" value={expr.linkId} onChange={(e) => onChange({ ...expr, linkId: e.target.value })} options={mapLinks.map((l) => ({ value: l.id, label: l.name }))} />}
          </Labeled>
          <OperandPicker label={t('formula.keyField')} value={expr.key} onChange={(key) => onChange({ ...expr, key })} fields={fields} />
        </div>
      );
    case 'autoNumber':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OperandPicker label={t('common.field')} value={expr.of} onChange={(of) => onChange({ ...expr, of })} fields={fields} />
          <Labeled label={`${t('formula.counter')} (${t('common.optional')})`}>
            {(id) => <TextInput id={id} className="!h-8" value={expr.counterName ?? ''} onChange={(e) => onChange({ ...expr, counterName: e.target.value || null })} />}
          </Labeled>
        </div>
      );
    case 'raw':
      return (
        <Labeled label={t('formula.rawText')} hint={t('formula.rawHint')}>
          {(id) => <TextArea id={id} rows={3} value={expr.text} onChange={(e) => onChange({ ...expr, text: e.target.value })} placeholder="Upper([Customer Name])" />}
        </Labeled>
      );
    default:
      return null;
  }
}
