import { Outlet } from 'react-router';
import { Toaster } from '../components/Toast';
import { BackGuardProvider } from './BackGuard';
import { ThemeSync } from './ThemeSync';

/** すべての画面の外側：戻るボタンの制御、テーマ、トースト */
export function RootLayout() {
  return (
    <BackGuardProvider>
      <ThemeSync />
      <Outlet />
      <Toaster />
    </BackGuardProvider>
  );
}
