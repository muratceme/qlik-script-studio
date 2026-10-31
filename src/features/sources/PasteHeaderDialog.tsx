import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SourceTable } from '@/model/types';
import { Button, Dialog, TextArea } from '@/components/ui';
import { splitHeaderLine } from '@/lib/fileFields';
import { setFieldsFromDetection, updateSourceTable } from '@/store/sourceActions';

export function PasteHeaderDialog({ open, onClose, table }: { open: boolean; onClose: () => void; table: SourceTable }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const { fields, delimiter } = splitHeaderLine(text);

  const apply = (mode: 'replace' | 'append') => {
    setFieldsFromDetection(table.id, fields, [], mode);
    if (table.kind === 'csv') updateSourceTable(table.id, (tbl) => void (tbl.csv && (tbl.csv.delimiter = delimiter)));
    setText('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('sources.pasteHeader')}
      width="sm"
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {table.fields.length > 0 ? (
            <Button onClick={() => apply('append')} disabled={fields.length === 0}>
              {t('sources.appendFields')}
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => apply('replace')} disabled={fields.length === 0}>
            {table.fields.length > 0 ? t('sources.replaceFields') : t('common.apply')}
          </Button>
        </>
      }
    >
      <p className="mb-2 text-sm text-fg-muted">{t('sources.pasteHeaderHint')}</p>
      <TextArea rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="OrderID;OrderDate;CustomerID;Amount" />
      {fields.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 text-xs text-fg-subtle">{t('sources.detected', { count: fields.length })}</p>
          <div className="flex flex-wrap gap-1">
            {fields.map((f) => (
              <span key={f} className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">
                {f}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
