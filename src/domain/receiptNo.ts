import type { DateString } from './types';

/**
 * 取引番号：開催日の月日 ＋ イベント内の連番（要件定義 6.5）
 * 例：('2026-11-03', 12) → '1103-012'。1,000 件目以降は 4 桁になる。
 */
export function formatReceiptNo(eventDate: DateString, seq: number): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(eventDate);
  if (!m) throw new RangeError(`開催日の形式が正しくありません: ${eventDate}`);
  if (!Number.isSafeInteger(seq) || seq < 1) {
    throw new RangeError(`連番は 1 以上の整数にしてください: ${seq}`);
  }
  return `${m[1]}${m[2]}-${String(seq).padStart(3, '0')}`;
}
