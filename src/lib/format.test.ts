import { describe, expect, it } from 'vitest';
import { digitsOnly, formatEventDate, formatYen, todayString } from './format';

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
});
