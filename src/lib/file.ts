/**
 * ファイルの保存（04-技術設計 7.2）
 * - iPhone：共有メニューを開く（「ファイルに保存」や AirDrop、LINE などを選べる）
 * - Android など：ダウンロードで保存する
 * - 共有メニューが使えないときは、ダウンロードにする
 *
 * 戻り値：保存した（または共有した）なら true、共有メニューを閉じて取りやめたら false
 */
export async function saveFile(blob: Blob, fileName: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: blob.type });
  if (
    isIos() &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return false;
      // 共有できなかったときは、ダウンロードで保存する
    }
  }
  download(blob, fileName);
  return true;
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  // すぐに解放すると保存できないブラウザがあるので、少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** iPhone・iPad か（iPad は Mac と同じ表示になることがあるので、タッチの有無でも見分ける） */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** 選んだファイルを文字として読む */
export function readFileText(file: Blob): Promise<string> {
  return file.text();
}
