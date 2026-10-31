import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud } from 'lucide-react';
import type { SourceTable } from '@/model/types';
import { Button, Dialog, Labeled, Select } from '@/components/ui';
import { detectFromFile, isExcelFile, type DetectedTable } from '@/lib/fileFields';
import { setFieldsFromDetection, updateSourceTable } from '@/store/sourceActions';
import { cn } from '@/lib/cn';

export function DetectFileDialog({
  open,
  onClose,
  table,
}: {
  open: boolean;
  onClose: () => void;
  table: SourceTable;
}) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DetectedTable | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const read = async (f: File, sheet?: string) => {
    setBusy(true);
    try {
      setFile(f);
      setResult(await detectFromFile(f, sheet));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
  };

  const apply = (mode: 'replace' | 'append') => {
    if (!result || !file) return;
    setFieldsFromDetection(table.id, result.fields, result.rows, mode);
    updateSourceTable(table.id, (tbl) => {
      if (!tbl.path && tbl.kind !== 'inline') tbl.path = file.name;
      if (tbl.kind === 'csv' && tbl.csv && result.delimiter) tbl.csv.delimiter = result.delimiter;
      if (tbl.kind === 'excel' && tbl.excel && result.sheet) tbl.excel.sheet = result.sheet;
    });
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t('sources.detectFromFile')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {table.fields.length > 0 ? (
            <Button onClick={() => apply('append')} disabled={!result || result.fields.length === 0}>
              {t('sources.appendFields')}
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={() => apply('replace')}
            disabled={!result || result.fields.length === 0}
          >
            {table.fields.length > 0 ? t('sources.replaceFields') : t('common.apply')}
          </Button>
        </>
      }
    >
      <label
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors',
          dragging ? 'border-accent bg-accent-soft/40' : 'border-border-strong hover:bg-surface-raised',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void read(f);
        }}
      >
        <UploadCloud className="size-8 text-fg-subtle" />
        <span className="text-fg-muted">{t('sources.detectHint')}</span>
        {file ? <span className="font-mono text-xs text-fg">{file.name}</span> : null}
        <input
          type="file"
          className="hidden"
          accept=".csv,.txt,.tsv,.xlsx,.xlsm,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void read(f);
            e.target.value = '';
          }}
        />
      </label>

      {busy ? <p className="mt-3 text-xs text-fg-subtle">…</p> : null}

      {result && file && isExcelFile(file) && result.sheets.length > 1 ? (
        <Labeled label={t('sources.detectSheet')} className="mt-3">
          {(id) => (
            <Select
              id={id}
              value={result.sheet ?? ''}
              onChange={(e) => void read(file, e.target.value)}
              options={result.sheets.map((s) => ({ value: s, label: s }))}
            />
          )}
        </Labeled>
      ) : null}

      {result && result.fields.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 text-xs text-fg-subtle">
            {t('sources.detected', { count: result.fields.length })}
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {result.fields.map((f) => (
                    <th
                      key={f}
                      className="whitespace-nowrap bg-surface-sunken px-2 py-1 text-left font-medium"
                    >
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {result.fields.map((_, j) => (
                      <td key={j} className="whitespace-nowrap px-2 py-1 font-mono text-fg-muted">
                        {row[j] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
