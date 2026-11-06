import type { DateString, Discount, EpochMs, Rounding } from '../domain/types';

const yenFormat = new Intl.NumberFormat('ja-JP');

/** 金額の表示：¥1,234（02-画面設計 1.2） */
export function formatYen(value: number): string {
  return `¥${yenFormat.format(value)}`;
}

const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' });

/** 開催日の表示：2026/11/03（火） */
export function formatEventDate(date: DateString): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return `${date.replaceAll('-', '/')}（${weekday.format(new Date(y, m - 1, d))}）`;
}

/** 今日の日付（端末の時刻で）：'YYYY-MM-DD' */
export function todayString(now: Date = new Date()): DateString {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 数字の入力欄の文字から、数字だけを取り出す（全角の数字も半角にする）。
 * 例：'１,２00円' → '1200'
 */
export function digitsOnly(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, '');
}

/** 日時の表示：2026/11/03 10:24 */
export function formatDateTime(ms: EpochMs): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 開催日の短い表示：11/3 */
export function formatShortDate(date: DateString): string {
  const [, m, d] = date.split('-').map(Number);
  return m && d ? `${m}/${d}` : date;
}

export const ROUNDING_LABELS: Record<Rounding, string> = {
  floor: '切り捨て',
  ceil: '切り上げ',
  round10: '10円単位',
};

/** 値引きの名前：「値引き 10%」「値引き」（円のときは金額の欄に額を出す） */
export function discountLabel(discount: Discount, prefix = '値引き'): string {
  return discount.kind === 'percent' ? `${prefix} ${discount.value}%` : prefix;
}
