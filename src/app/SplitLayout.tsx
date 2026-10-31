import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useUiStore } from '@/store/uiStore';
import { ScriptPane } from '@/features/script/ScriptPane';
import { cn } from '@/lib/cn';

/** Main content on the left, collapsible live script on the right (stacked on small screens). */
export function SplitLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.scriptPaneOpen);
  const toggle = useUiStore((s) => s.toggleScriptPane);
  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className={cn('relative min-h-0 flex-1 overflow-auto', open ? 'lg:basis-3/5' : '')}>
        {children}
        <div className="absolute right-2 top-2 z-10 hidden lg:block">
          <IconButton label={t('script.title')} size="sm" variant="secondary" onClick={toggle}>
            {open ? <PanelRightClose /> : <PanelRightOpen />}
          </IconButton>
        </div>
      </div>
      <aside
        className={cn(
          'min-h-0 border-t border-border bg-surface-raised lg:border-l lg:border-t-0',
          open ? 'h-[40vh] lg:h-auto lg:basis-2/5' : 'hidden',
        )}
      >
        <ScriptPane />
      </aside>
    </div>
  );
}
