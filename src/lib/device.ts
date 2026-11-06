/**
 * 端末と起動状態の判定（04-技術設計 5.5、要件定義 F-12）
 */

/** ホーム画面から起動しているか */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  );
}

/** iPhone・iPad か（iPad は Mac と同じ表示になることがあるので、タッチの有無でも見分ける） */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}
