import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Dialog, Labeled, Select, TextInput } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const settings = useProjectStore((s) => s.project.settings);
  const update = useProjectStore((s) => s.update);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('app.settings')}
      width="sm"
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('common.done')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Labeled label={t('script.locale')}>
          {(id) => (
            <Select
              id={id}
              value={settings.locale}
              onChange={(e) => update((p) => void (p.settings.locale = e.target.value as 'en' | 'tr'))}
              options={[
                { value: 'en', label: 'EN (M/D/YYYY, 1,234.56)' },
                { value: 'tr', label: 'TR (DD.MM.YYYY, 1.234,56)' },
              ]}
            />
          )}
        </Labeled>
        <Labeled label={t('script.dialect')}>
          {(id) => (
            <Select
              id={id}
              value={settings.dialect}
              onChange={(e) => update((p) => void (p.settings.dialect = e.target.value as 'sense' | 'view'))}
              options={[
                { value: 'sense', label: t('script.sense') },
                { value: 'view', label: t('script.view') },
              ]}
            />
          )}
        </Labeled>
        <Labeled label={t('script.qvdPath')}>
          {(id) => (
            <TextInput
              id={id}
              value={settings.qvdStorePath}
              placeholder="lib://QVD/"
              onChange={(e) => update((p) => void (p.settings.qvdStorePath = e.target.value))}
            />
          )}
        </Labeled>
        <Checkbox
          label={t('script.useTabs')}
          checked={settings.useTabs}
          onChange={(e) => update((p) => void (p.settings.useTabs = e.target.checked))}
        />
        <Checkbox
          label={t('script.dropConsumed')}
          checked={settings.dropConsumedSources}
          onChange={(e) => update((p) => void (p.settings.dropConsumedSources = e.target.checked))}
        />
      </div>
    </Dialog>
  );
}
