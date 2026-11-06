import { describe, expect, it } from 'vitest';
import {
  digitsOnly,
  discountLabel,
  formatDateTime,
  formatEventDate,
  formatShortDate,
  formatYen,
  todayString,
} from './format';

describe('表示用の整形', () => {
  it('金額は ¥1,234 の形', () => {
    expect(formatYen(0)).toBe('¥0');
    expect(formatYen(1234)).toBe('¥1,234');
    expect(formatYen(1000000)).toBe('¥1,000,000');
  });

  it('開催日に曜日を付ける', () => {
    expect(formatEventDate('2026-11-03')).toBe('2026/11/03（火）');
  });

  it('今日の日付は端末の時刻で YYYY-MM-DD', () => {
    expect(todayString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('数字だけを取り出す', () => {
    expect(digitsOnly('１,２00円')).toBe('1200');
    expect(digitsOnly('-5.5')).toBe('55');
    expect(digitsOnly('')).toBe('');
  });

  it('日時は 2026/11/03 10:24、短い日付は 11/3', () => {
    expect(formatDateTime(new Date(2026, 10, 3, 10, 24).getTime())).toBe('2026/11/03 10:24');
    expect(formatShortDate('2026-11-03')).toBe('11/3');
  });

  it('値引きの名前', () => {
    expect(discountLabel({ kind: 'percent', value: 10, rounding: 'floor' })).toBe('値引き 10%');
    expect(discountLabel({ kind: 'yen', value: 100 })).toBe('値引き');
    expect(discountLabel({ kind: 'yen', value: 100 }, '全体値引き')).toBe('全体値引き');
  });
});
