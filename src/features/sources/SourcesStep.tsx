import { useTranslation } from 'react-i18next';
import { Database, Plus, Sparkles } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { addSourceTable } from '@/store/sourceActions';
import { loadSampleProject } from '@/features/project/projectActions';
import { SourceTableList } from './SourceTableList';
import { SourceTableEditor } from './SourceTableEditor';

export function SourcesStep() {
  const { t } = useTranslation();
  const sources = useProjectStore((s) => s.project.sources);
  const selectedId = useUiStore((s) => s.selectedSourceId);
  const selected = sources.find((s) => s.id === selectedId) ?? sources[0];

  if (sources.length === 0) {
    return (
      <EmptyState
        icon={<Database />}
        title={t('sources.empty')}
        hint={t('sources.emptyHint')}
        actions={
          <>
            <Button variant="primary" icon={<Plus />} onClick={() => addSourceTable()}>
              {t('sources.addTable')}
            </Button>
            <Button icon={<Sparkles />} onClick={loadSampleProject}>
              {t('app.loadSample')}
            </Button>
          </>
        }
      />
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
      <SourceTableList sources={sources} selectedId={selected?.id ?? null} />
      {selected ? <SourceTableEditor key={selected.id} table={selected} /> : null}
    </div>
  );
}
