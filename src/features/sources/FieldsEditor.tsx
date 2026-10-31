import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ClipboardPaste, FileSearch, Plus, Trash2 } from 'lucide-react';
import type { DataType, FieldRole, SourceTable } from '@/model/types';
import { DATA_TYPES, FIELD_ROLES } from '@/model/types';
import { Button, IconButton, Select, TextInput } from '@/components/ui';
import { addField, moveField, removeField, updateField } from '@/store/sourceActions';
import { PasteHeaderDialog } from './PasteHeaderDialog';
import { DetectFileDialog } from './DetectFileDialog';
import { SampleRowsPreview } from './SampleRowsPreview';

export function FieldsEditor({ table }: { table: SourceTable }) {
  const { t } = useTranslation();
  const [paste, setPaste] = useState(false);
  const [detect, setDetect] = useState(false);

  const onAdd = () => {
    const id = addField(table.id, '');
    requestAnimationFrame(() => document.getElementById(`field-name-${id}`)?.focus());
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">
          {t('sources.fields')} <span className="font-normal text-fg-subtle">({table.fields.length})</span>
        </h3>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" icon={<Plus />} onClick={onAdd}>
            {t('sources.addField')}
          </Button>
          <Button size="sm" icon={<ClipboardPaste />} onClick={() => setPaste(true)}>
            {t('sources.pasteHeader')}
          </Button>
          {table.kind !== 'sql' ? (
            <Button size="sm" icon={<FileSearch />} onClick={() => setDetect(true)}>
              {t('sources.detectFromFile')}
            </Button>
          ) : null}
        </div>
      </div>

      {table.fields.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong p-4 text-center text-sm text-fg-muted">
          {t('sources.noFields')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-fg-muted">
                <th className="w-8" />
                <th className="py-1 pr-2 font-medium">{t('sources.fieldName')}</th>
                <th className="py-1 pr-2 font-medium">{t('sources.alias')}</th>
                <th className="py-1 pr-2 font-medium">{t('rolesStep.setRole')}</th>
                <th className="py-1 pr-2 font-medium">{t('common.type')}</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {table.fields.map((field, index) => (
                <tr key={field.id} className="border-t border-border">
                  <td className="py-1 pr-1 text-xs text-fg-subtle">{index + 1}</td>
                  <td className="py-1 pr-2">
                    <TextInput
                      id={`field-name-${field.id}`}
                      aria-label={t('sources.fieldName')}
                      className="!h-8"
                      value={field.name}
                      onChange={(e) => updateField(table.id, field.id, (f) => void (f.name = e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onAdd();
                        }
                      }}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <TextInput
                      aria-label={t('sources.alias')}
                      className="!h-8"
                      value={field.alias ?? ''}
                      placeholder={t('common.optional')}
                      onChange={(e) =>
                        updateField(table.id, field.id, (f) => void (f.alias = e.target.value || null))
                      }
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Select
                      aria-label={t('rolesStep.setRole')}
                      className="!h-8 !text-xs"
                      value={field.role}
                      onChange={(e) =>
                        updateField(table.id, field.id, (f) => void (f.role = e.target.value as FieldRole))
                      }
                      options={FIELD_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Select
                      aria-label={t('common.type')}
                      className="!h-8 !text-xs"
                      value={field.dataType}
                      onChange={(e) =>
                        updateField(table.id, field.id, (f) => void (f.dataType = e.target.value as DataType))
                      }
                      options={DATA_TYPES.map((d) => ({ value: d, label: t(`dataTypes.${d}`) }))}
                    />
                  </td>
                  <td className="py-1">
                    <div className="flex justify-end gap-0.5">
                      <IconButton
                        label={t('common.moveUp')}
                        size="sm"
                        disabled={index === 0}
                        onClick={() => moveField(table.id, index, index - 1)}
                      >
                        <ArrowUp className="size-3.5" />
                      </IconButton>
                      <IconButton
                        label={t('common.moveDown')}
                        size="sm"
                        disabled={index === table.fields.length - 1}
                        onClick={() => moveField(table.id, index, index + 1)}
                      >
                        <ArrowDown className="size-3.5" />
                      </IconButton>
                      <IconButton
                        label={t('common.remove')}
                        size="sm"
                        variant="danger"
                        onClick={() => removeField(table.id, field.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {table.sampleRows && table.sampleRows.length > 0 ? <SampleRowsPreview table={table} /> : null}

      <PasteHeaderDialog open={paste} onClose={() => setPaste(false)} table={table} />
      <DetectFileDialog open={detect} onClose={() => setDetect(false)} table={table} />
    </section>
  );
}
