import { useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import { useThemeStore } from '@/stores/theme-store';

export function ThemeSyncer() {
  const mode = useThemeStore((s) => s.mode);
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(mode);
  }, [mode, setColorScheme]);

  return null;
}
