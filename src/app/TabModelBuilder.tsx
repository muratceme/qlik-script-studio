import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Stepper } from '@/components/ui';
import { useUiStore, type WizardStep } from '@/store/uiStore';
import { SplitLayout } from './SplitLayout';
import { SourcesStep } from '@/features/sources/SourcesStep';
import { RolesStep } from '@/features/roles/RolesStep';
import { DesignStep } from '@/features/targets/DesignStep';

export function TabModelBuilder() {
  const { t } = useTranslation();
  const step = useUiStore((s) => s.step);
  const setStep = useUiStore((s) => s.setStep);

  const steps = [
    { label: t('steps.sources'), hint: t('steps.sourcesHint') },
    { label: t('steps.roles'), hint: t('steps.rolesHint') },
    { label: t('steps.design'), hint: t('steps.designHint') },
  ];

  return (
    <SplitLayout>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border px-4 py-3">
          <Stepper steps={steps} current={step - 1} onSelect={(i) => setStep((i + 1) as WizardStep)} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {step === 1 ? <SourcesStep /> : step === 2 ? <RolesStep /> : <DesignStep />}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <span className="text-xs text-fg-subtle">{t('steps.stepOf', { current: step, total: 3 })}</span>
          <div className="flex gap-2">
            <Button size="sm" icon={<ArrowLeft />} disabled={step === 1} onClick={() => setStep((step - 1) as WizardStep)}>
              {t('steps.back')}
            </Button>
            <Button size="sm" variant="primary" icon={<ArrowRight />} disabled={step === 3} onClick={() => setStep((step + 1) as WizardStep)}>
              {t('steps.next')}
            </Button>
          </div>
        </div>
      </div>
    </SplitLayout>
  );
}
