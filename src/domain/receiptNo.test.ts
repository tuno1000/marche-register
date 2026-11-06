import { describe, expect, it } from 'vitest';
import { formatReceiptNo } from './receiptNo';

describe('取引番号', () => {
  it('開催日の月日と 3 桁の連番', () => {
    expect(formatReceiptNo('2026-11-03', 1)).toBe('1103-001');
    expect(formatReceiptNo('2026-11-03', 12)).toBe('1103-012');
    expect(formatReceiptNo('2026-11-03', 999)).toBe('1103-999');
  });

  it('1,000 件目以降は 4 桁', () => {
    expect(formatReceiptNo('2026-11-03', 1000)).toBe('1103-1000');
  });

  it('形式が正しくなければエラー', () => {
    expect(() => formatReceiptNo('2026/11/03', 1)).toThrow(RangeError);
    expect(() => formatReceiptNo('2026-11-03', 0)).toThrow(RangeError);
  });
});
