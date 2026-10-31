import { useEffect } from 'react';
import { useUiStore, resolveTheme } from '@/store/uiStore';

/** Keeps `<html data-theme>` in sync with the stored preference and the OS. */
export function useTheme(): void {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme);
    };
    apply();
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
