let requested = false;

/**
 * ブラウザに「データを消さないで」と頼む（04-技術設計 5.4）。
 * 商品かイベントを初めて保存したときに呼ぶ。起動中に 1 回だけ要求し、失敗しても何もしない。
 */
export async function requestPersistentStorage(): Promise<void> {
  if (requested) return;
  requested = true;
  try {
    if (!navigator.storage?.persist) return;
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch {
    // 使えない端末では何もしない
  }
}
