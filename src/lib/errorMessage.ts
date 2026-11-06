import { isAppError } from '../domain/errors';

/** 例外を、画面に出す文言にする（04-技術設計 8 章） */
export function errorMessage(e: unknown, fallback = '保存できませんでした'): string {
  if (isAppError(e)) return e.message;
  if (isQuotaExceeded(e)) return '保存容量が足りません。不要な商品画像を減らしてください';
  return fallback;
}

function isQuotaExceeded(e: unknown): boolean {
  const names = [e, (e as { inner?: unknown } | null)?.inner].map(
    (x) => (x as { name?: unknown } | null)?.name,
  );
  return names.includes('QuotaExceededError');
}
