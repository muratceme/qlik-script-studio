import { useTranslation } from 'react-i18next';
import { Blocks, Share2 } from 'lucide-react';
import { useUiStore, type MainTab } from '@/store/uiStore';
import { AppHeader } from './AppHeader';
import { TabModelBuilder } from './TabModelBuilder';
import { TabRelations } from './TabRelations';
import { useTheme } from './useTheme';
import { useLanguage } from './useLanguage';
import { useUndoShortcuts } from './useUndoShortcuts';
import { ToastViewport } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';

export function App() {
  useTheme();
  useLanguage();
  useUndoShortcuts();
  const { t } = useTranslation();
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);

  const tabs: { id: MainTab; label: string; icon: typeof Blocks }[] = [
    { id: 'builder', label: t('tabs.builder'), icon: Blocks },
    { id: 'relations', label: t('tabs.relations'), icon: Share2 },
  ];

  return (
    <div className="flex h-full flex-col bg-surface text-fg">
      <AppHeader />
      <nav className="flex items-end gap-1 border-b border-border bg-surface-raised px-3" role="tablist" aria-label="Main">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="min-h-0 flex-1">
        <div role="tabpanel" id="panel-builder" aria-labelledby="tab-builder" hidden={activeTab !== 'builder'} className="h-full">
          {activeTab === 'builder' ? <TabModelBuilder /> : null}
        </div>
        <div role="tabpanel" id="panel-relations" aria-labelledby="tab-relations" hidden={activeTab !== 'relations'} className="h-full">
          {activeTab === 'relations' ? <TabRelations /> : null}
        </div>
      </main>
      <ToastViewport />
    </div>
  );
}
