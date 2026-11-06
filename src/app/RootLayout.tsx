import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { Toaster } from '../components/Toast';
import { BackGuardProvider } from './BackGuard';
import { useCartStore } from '../features/checkout/cartStore';
import { ThemeSync } from './ThemeSync';

/** すべての画面の外側：戻るボタンの制御、テーマ、トースト */
export function RootLayout() {
  // 前回のカートを読み戻す（アプリを閉じても残すため）
  useEffect(() => {
    void useCartStore.getState().hydrate();
  }, []);

  return (
    <BackGuardProvider>
      <ThemeSync />
      <Outlet />
      <Toaster />
    </BackGuardProvider>
  );
}
