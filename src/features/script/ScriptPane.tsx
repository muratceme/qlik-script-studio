import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import { Button, Checkbox, Select } from '@/components/ui';
import { useProjectStore } from '@/store/projectStore';
import { copyText, downloadText, safeFileName } from '@/lib/download';
import { CodeView } from './CodeView';
import { DiagnosticList } from './DiagnosticList';
import { useScript } from './useScript';

export function ScriptPane() {
  const { t } = useTranslation();
  const result = useScript();
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  const [copied, setCopied] = useState(false);

  const script = result.script ?? '';
  const lineCount = script ? script.split('\n').length - 1 : 0;

  const onCopy = async () => {
    if (await copyText(script)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col" aria-labelledby="script-pane-title">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 id="script-pane-title" className="flex items-center gap-2 text-sm font-semibold">
          <FileCode2 className="size-4 text-accent" />
          {t('script.title')}
          {script ? <span className="text-xs font-normal text-fg-subtle">{t('script.lines', { count: lineCount })}</span> : null}
        </h2>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" icon={copied ? <Check /> : <Copy />} onClick={onCopy} disabled={!script}>
            {copied ? t('common.copied') : t('script.copy')}
          </Button>
          <Button
            size="sm"
            icon={<Download />}
            onClick={() => downloadText(safeFileName(project.name, 'qvs'), script)}
            disabled={!script}
          >
            {t('script.download')}
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-fg-muted">{t('script.locale')}</span>
          <Select
            className="!h-7 w-auto !text-xs"
            value={project.settings.locale}
            onChange={(e) => update((p) => void (p.settings.locale = e.target.value as 'en' | 'tr'))}
            options={[
              { value: 'en', label: 'EN' },
              { value: 'tr', label: 'TR' },
            ]}
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-fg-muted">{t('script.dialect')}</span>
          <Select
            className="!h-7 w-auto !text-xs"
            value={project.settings.dialect}
            onChange={(e) => update((p) => void (p.settings.dialect = e.target.value as 'sense' | 'view'))}
            options={[
              { value: 'sense', label: t('script.sense') },
              { value: 'view', label: t('script.view') },
            ]}
          />
        </label>
        <Checkbox
          label={<span className="text-xs">{t('script.useTabs')}</span>}
          checked={project.settings.useTabs}
          onChange={(e) => update((p) => void (p.settings.useTabs = e.target.checked))}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {result.errors.length > 0 ? (
          <div className="p-3">
            <h3 className="mb-1 text-sm font-semibold text-danger">{t('script.errorsTitle')}</h3>
            <p className="mb-3 text-xs text-fg-muted">{t('script.errorsHint')}</p>
            <DiagnosticList items={result.errors} compact />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {result.warnings.length > 0 ? (
              <div className="border-b border-border p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning">{t('script.warningsTitle')}</h3>
                <DiagnosticList items={result.warnings} compact />
              </div>
            ) : null}
            <CodeView value={script} className="min-h-0 flex-1" />
          </div>
        )}
      </div>
    </section>
  );
}
