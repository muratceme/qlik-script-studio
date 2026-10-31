import { useEffect } from 'react';
import i18n from '@/i18n';
import { useUiStore } from '@/store/uiStore';

export function useLanguage(): void {
  const language = useUiStore((s) => s.language);
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [language]);
}
