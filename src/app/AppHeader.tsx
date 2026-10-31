import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FilePlus2, Github, Moon, Redo2, Sparkles, Sun, Undo2, Upload, Languages } from 'lucide-react';
import { Button, IconButton, Dialog } from '@/components/ui';
import { useProjectStore, useTemporalStore } from '@/store/projectStore';
import { useUiStore, resolveTheme } from '@/store/uiStore';
import { exportProject, importProjectFile, loadSampleProject, startNewProject } from '@/features/project/projectActions';
import { toast } from '@/components/ui/Toast';

const REPO_URL = 'https://github.com/muratceme/qlik-script-studio';

export function AppHeader() {
  const { t } = useTranslation();
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  const { undo, redo, pastStates, futureStates } = useTemporalStore((s) => s);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importIssues, setImportIssues] = useState<string[] | null>(null);

  const isEmpty = project.sources.length === 0 && project.targets.length === 0;

  const confirmReplace = (message: string) => isEmpty || window.confirm(message);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (!confirmReplace(t('app.newProjectConfirm'))) return;
    const result = await importProjectFile(file);
    if (!result.ok) setImportIssues(result.issues);
  };

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
      <div className="flex items-center gap-2">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-7 rounded-md" />
        <span className="hidden text-sm font-semibold sm:block">{t('app.title')}</span>
      </div>
      <input
        aria-label={t('app.projectName')}
        className="h-8 w-44 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium hover:border-border focus:border-accent"
        value={project.name}
        onChange={(e) => update((p) => void (p.name = e.target.value))}
      />
      <div className="flex items-center gap-0.5">
        <IconButton label={t('app.undo')} size="sm" onClick={() => undo()} disabled={pastStates.length === 0}>
          <Undo2 />
        </IconButton>
        <IconButton label={t('app.redo')} size="sm" onClick={() => redo()} disabled={futureStates.length === 0}>
          <Redo2 />
        </IconButton>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-1">
        <Button size="sm" icon={<Sparkles />} onClick={() => confirmReplace(t('app.loadSampleConfirm')) && loadSampleProject()}>
          {t('app.loadSample')}
        </Button>
        <Button
          size="sm"
          icon={<FilePlus2 />}
          onClick={() => confirmReplace(t('app.newProjectConfirm')) && startNewProject(t('app.untitled'))}
        >
          {t('app.newProject')}
        </Button>
        <Button size="sm" icon={<Upload />} onClick={() => fileInput.current?.click()}>
          {t('app.importJson')}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button size="sm" icon={<Download />} onClick={exportProject} disabled={isEmpty}>
          {t('app.exportJson')}
        </Button>
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <IconButton
          label={`${t('app.language')}: ${language.toUpperCase()}`}
          size="sm"
          onClick={() => {
            const next = language === 'en' ? 'tr' : 'en';
            setLanguage(next);
            toast(next === 'en' ? 'English' : 'Türkçe');
          }}
        >
          <span className="flex items-center gap-1 text-xs font-semibold">
            <Languages className="size-4" />
            {language.toUpperCase()}
          </span>
        </IconButton>
        <IconButton
          label={`${t('app.theme')}: ${t(resolveTheme(theme) === 'dark' ? 'app.themeDark' : 'app.themeLight')}`}
          size="sm"
          onClick={() => setTheme(resolveTheme(theme) === 'dark' ? 'light' : 'dark')}
        >
          {resolveTheme(theme) === 'dark' ? <Sun /> : <Moon />}
        </IconButton>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label={t('app.github')}
          title={t('app.github')}
          className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunken hover:text-fg"
        >
          <Github className="size-4" />
        </a>
      </div>
      <Dialog open={importIssues !== null} onClose={() => setImportIssues(null)} title={t('app.importJson')} width="sm">
        <p className="text-sm text-danger">{t('app.importFailed')}</p>
        {importIssues && importIssues.length > 0 ? (
          <>
            <p className="mt-3 text-xs font-medium text-fg-muted">{t('app.importIssues')}</p>
            <ul className="mt-1 list-disc pl-5 font-mono text-xs text-fg-muted">
              {importIssues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </>
        ) : null}
      </Dialog>
    </header>
  );
}
