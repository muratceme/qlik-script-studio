import { useTranslation } from 'react-i18next';
import type { CsvDelimiter, CsvEncoding, SourceKind, SourceTable } from '@/model/types';
import { SOURCE_KINDS } from '@/model/types';
import { Checkbox, Labeled, Select, TextArea, TextInput } from '@/components/ui';
import { setSourceKind, updateSourceTable } from '@/store/sourceActions';
import { ConnectionPicker } from './ConnectionPicker';
import { FieldsEditor } from './FieldsEditor';
import { InlineRowsEditor } from './InlineRowsEditor';

export function SourceTableEditor({ table }: { table: SourceTable }) {
  const { t } = useTranslation();
  const set = (recipe: (tbl: SourceTable) => void) => updateSourceTable(table.id, recipe);
  const isFile = table.kind === 'qvd' || table.kind === 'excel' || table.kind === 'csv';

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-5">
      <section className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface-raised p-4 sm:grid-cols-2">
        <Labeled label={t('sources.tableName')}>
          {(id) => (
            <TextInput
              id={id}
              value={table.name}
              onChange={(e) => set((tbl) => void (tbl.name = e.target.value))}
            />
          )}
        </Labeled>
        <Labeled label={t('sources.kind')}>
          {(id) => (
            <Select
              id={id}
              value={table.kind}
              onChange={(e) => setSourceKind(table.id, e.target.value as SourceKind)}
              options={SOURCE_KINDS.map((k) => ({ value: k, label: t(`sourceKinds.${k}`) }))}
            />
          )}
        </Labeled>
        {table.kind !== 'inline' ? (
          <Labeled label={t('sources.connection')} hint={isFile ? t('sources.connectionHint') : undefined}>
            {() => (
              <ConnectionPicker
                value={table.connectionId}
                kind={table.kind === 'sql' ? 'database' : 'folder'}
                onChange={(id) => set((tbl) => void (tbl.connectionId = id))}
              />
            )}
          </Labeled>
        ) : null}
        {isFile ? (
          <Labeled label={t('sources.path')} hint={t('sources.pathHint')}>
            {(id) => (
              <TextInput
                id={id}
                value={table.path}
                placeholder={
                  table.kind === 'qvd' ? 'Sales.qvd' : table.kind === 'excel' ? 'Sales.xlsx' : 'Sales.csv'
                }
                onChange={(e) => set((tbl) => void (tbl.path = e.target.value))}
              />
            )}
          </Labeled>
        ) : null}
        {table.kind === 'excel' && table.excel ? (
          <>
            <Labeled label={t('sources.sheet')}>
              {(id) => (
                <TextInput
                  id={id}
                  value={table.excel!.sheet}
                  onChange={(e) => set((tbl) => void (tbl.excel!.sheet = e.target.value))}
                />
              )}
            </Labeled>
            <Labeled label={t('sources.headerRow')}>
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={1}
                  value={table.excel!.headerRow}
                  onChange={(e) =>
                    set((tbl) => void (tbl.excel!.headerRow = Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              )}
            </Labeled>
          </>
        ) : null}
        {table.kind === 'csv' && table.csv ? (
          <>
            <Labeled label={t('sources.delimiter')}>
              {(id) => (
                <Select
                  id={id}
                  value={table.csv!.delimiter}
                  onChange={(e) => set((tbl) => void (tbl.csv!.delimiter = e.target.value as CsvDelimiter))}
                  options={[
                    { value: ',', label: t('sources.delimiterComma') },
                    { value: ';', label: t('sources.delimiterSemicolon') },
                    { value: '\t', label: t('sources.delimiterTab') },
                    { value: '|', label: t('sources.delimiterPipe') },
                  ]}
                />
              )}
            </Labeled>
            <Labeled label={t('sources.encoding')}>
              {(id) => (
                <Select
                  id={id}
                  value={table.csv!.encoding}
                  onChange={(e) => set((tbl) => void (tbl.csv!.encoding = e.target.value as CsvEncoding))}
                  options={[
                    { value: 'utf8', label: t('sources.encodingUtf8') },
                    { value: 'ansi', label: t('sources.encodingAnsi') },
                    { value: 'unicode', label: t('sources.encodingUnicode') },
                  ]}
                />
              )}
            </Labeled>
            <Checkbox
              label={t('sources.hasHeader')}
              checked={table.csv.hasHeader}
              onChange={(e) => set((tbl) => void (tbl.csv!.hasHeader = e.target.checked))}
            />
            <Checkbox
              label={t('sources.msq')}
              checked={table.csv.msq}
              onChange={(e) => set((tbl) => void (tbl.csv!.msq = e.target.checked))}
            />
          </>
        ) : null}
        {table.kind === 'sql' && table.sql ? (
          <Labeled label={t('sources.sqlQuery')} hint={t('sources.sqlQueryHint')} className="sm:col-span-2">
            {(id) => (
              <TextArea
                id={id}
                rows={4}
                value={table.sql!.query}
                placeholder="SELECT OrderID, CustomerID, Amount FROM dbo.Orders"
                onChange={(e) => set((tbl) => void (tbl.sql!.query = e.target.value))}
              />
            )}
          </Labeled>
        ) : null}
        <Checkbox
          className="sm:col-span-2"
          label={t('sources.keepInModel')}
          hint={t('sources.keepInModelHint')}
          checked={table.keepInModel}
          onChange={(e) => set((tbl) => void (tbl.keepInModel = e.target.checked))}
        />
      </section>

      <FieldsEditor table={table} />

      {table.kind === 'inline' && table.inline ? <InlineRowsEditor table={table} /> : null}
    </div>
  );
}
