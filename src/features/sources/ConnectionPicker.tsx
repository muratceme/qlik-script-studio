import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { ConnectionKind } from '@/model/types';
import { Button, Dialog, Labeled, Select, TextInput } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { addConnection } from '@/store/sourceActions';

export function ConnectionPicker({
  value,
  kind,
  onChange,
}: {
  value: string | null;
  kind: ConnectionKind;
  onChange: (id: string | null) => void;
}) {
  const { t } = useTranslation();
  const connections = useProjectStore((s) => s.project.connections).filter((c) => c.kind === kind);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(kind === 'folder' ? 'lib://DataFiles' : '');

  const submit = () => {
    if (!name.trim()) return;
    onChange(addConnection(name.trim(), kind));
    setOpen(false);
    setName('');
  };

  return (
    <>
      <div className="flex gap-1.5">
        <Select
          className="flex-1"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={t('sources.noConnection')}
          options={connections.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Button icon={<Plus />} onClick={() => setOpen(true)} aria-label={t('sources.addConnection')} />
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('sources.addConnection')}
        width="sm"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={submit} disabled={!name.trim()}>
              {t('common.add')}
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Labeled label={t('sources.connectionName')} hint={kind === 'folder' ? t('sources.connectionHint') : undefined}>
            {(id) => <TextInput id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'folder' ? 'lib://DataFiles' : 'MyDatabase'} />}
          </Labeled>
          <p className="text-xs text-fg-subtle">
            {t('sources.connectionKind')}: {kind === 'folder' ? t('sources.connectionFolder') : t('sources.connectionDatabase')}
          </p>
        </form>
      </Dialog>
    </>
  );
}
