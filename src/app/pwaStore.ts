import { create } from 'zustand';

/**
 * PWA の状態（更新とインストール）。Service Worker の登録は main.tsx で行い、ここに知らせる
 */

/** Chrome などの「インストール」の案内（標準の型がないので必要な分だけ） */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** 新しい版の準備ができたら、切り替えて再読み込みする関数 */
  applyUpdate: (() => Promise<void>) | null;
  /** Android の Chrome などで使える、インストールの案内 */
  installPrompt: BeforeInstallPromptEvent | null;
  /** このページでインストールを終えた */
  installed: boolean;
}

export const usePwaStore = create<PwaState>(() => ({
  applyUpdate: null,
  installPrompt: null,
  installed: false,
}));

/** 更新の確認は、起動時と、アプリに戻ってきたとき（1 時間に 1 回まで）に行う（04-技術設計 5.3） */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function startUpdateChecks(
  registration: { update: () => Promise<unknown> },
  now: () => number = Date.now,
): () => void {
  let lastCheck = now();
  const check = () => {
    if (document.visibilityState !== 'visible') return;
    if (now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastCheck = now();
    // 通信がないときは失敗するだけで、何もしない
    registration.update().catch(() => {});
  };
  document.addEventListener('visibilitychange', check);
  return () => document.removeEventListener('visibilitychange', check);
}

/** beforeinstallprompt は画面が出る前に起きることがあるので、起動してすぐ受け取っておく */
export function listenInstallEvents(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.setState({ installPrompt: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => {
    usePwaStore.setState({ installPrompt: null, installed: true });
  });
}
