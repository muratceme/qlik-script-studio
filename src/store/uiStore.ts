import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '@/i18n';

export type Theme = 'light' | 'dark' | 'system';
export type MainTab = 'builder' | 'relations';
export type WizardStep = 1 | 2 | 3;

interface UiState {
  theme: Theme;
  language: Language;
  activeTab: MainTab;
  step: WizardStep;
  selectedSourceId: string | null;
  selectedTargetId: string | null;
  scriptPaneOpen: boolean;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setActiveTab: (tab: MainTab) => void;
  setStep: (step: WizardStep) => void;
  selectSource: (id: string | null) => void;
  selectTarget: (id: string | null) => void;
  toggleScriptPane: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'en',
      activeTab: 'builder',
      step: 1,
      selectedSourceId: null,
      selectedTargetId: null,
      scriptPaneOpen: true,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setStep: (step) => set({ step }),
      selectSource: (selectedSourceId) => set({ selectedSourceId }),
      selectTarget: (selectedTargetId) => set({ selectedTargetId }),
      toggleScriptPane: () => set((s) => ({ scriptPaneOpen: !s.scriptPaneOpen })),
    }),
    { name: 'qlik-script-studio:ui', version: 1 },
  ),
);

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
