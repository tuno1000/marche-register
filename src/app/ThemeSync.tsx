import { useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';

/** ブラウザのアドレスバーなどの色（tokens.css の --color-bg と同じ） */
const THEME_COLOR = { light: '#ffffff', dark: '#121212' } as const;

/** 設定のテーマを <html data-theme> に反映する（04-技術設計 6 章、02-画面設計 D-6） */
export function ThemeSync() {
  const theme = useSettings()?.theme;

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  return null;
}
