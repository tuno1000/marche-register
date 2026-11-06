import { useEffect } from 'react';

/**
 * この画面を開いている間、スマホの画面が自動で暗くならないようにする（04-技術設計 7.4、DT-2）。
 * アプリを裏に回すと自動で解放されるので、前面に戻ったら取り直す。
 * 使えない端末や、要求に失敗したときは何もしない。
 */
export function useWakeLock(active = true): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (disposed) void s.release().catch(() => {});
        else sentinel = s;
      } catch {
        // 省電力モードなどで断られたときは何もしない
      }
    };

    const onVisibility = () => void request();
    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
