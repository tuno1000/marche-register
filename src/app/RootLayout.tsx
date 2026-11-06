import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Toaster } from '../components/Toast';
import { getKv } from '../db/kv';
import { useCartStore } from '../features/checkout/cartStore';
import { isStandalone } from '../lib/device';
import { BackGuardProvider } from './BackGuard';
import { ThemeSync } from './ThemeSync';

/**
 * 起動時の判定（04-技術設計 3 章）
 * - checking：「このまま使う」を選んだか読んでいる
 * - install：ホーム画面から起動しておらず、選んでもいない → インストール案内へ
 * - ok：そのまま表示する
 */
type StartupState = 'checking' | 'install' | 'ok';

/** すべての画面の外側：起動時の判定、戻るボタンの制御、テーマ、トースト */
export function RootLayout() {
  const { pathname } = useLocation();
  // ホーム画面から起動していれば、すぐに表示する
  const [startup, setStartup] = useState<StartupState>(() => (isStandalone() ? 'ok' : 'checking'));

  // 前回のカートを読み戻す（アプリを閉じても残すため）
  useEffect(() => {
    void useCartStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (startup !== 'checking') return;
    let cancelled = false;
    getKv('installWarningDismissed')
      .catch(() => false)
      .then((dismissed) => {
        if (!cancelled) setStartup(dismissed ? 'ok' : 'install');
      });
    return () => {
      cancelled = true;
    };
  }, [startup]);

  // インストール案内を開いたら、あとは自由に移れる（［このまま使う］で会計画面へ）
  if (startup === 'install' && pathname === '/install') setStartup('ok');

  if (startup === 'checking') return null;
  // 会計画面が一瞬見えないよう、案内に移るまでは何も表示しない
  if (startup === 'install' && pathname !== '/install') return <Navigate to="/install" replace />;

  return (
    <BackGuardProvider>
      <ThemeSync />
      <Outlet />
      <Toaster />
    </BackGuardProvider>
  );
}
