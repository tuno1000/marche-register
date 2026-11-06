import { describe, expect, it } from 'vitest';
import { discountAmount, percentDiscountAmount } from './discount';

describe('% 値引きの額（03 の 4.1）', () => {
  it('555 円の 10% 引き（要件定義 6.2 の例）', () => {
    expect(percentDiscountAmount(555, 10, 'floor')).toBe(55);
    expect(percentDiscountAmount(555, 10, 'ceil')).toBe(56);
    expect(percentDiscountAmount(555, 10, 'round10')).toBe(65);
  });

  it('555 円の 15% 引き（03 の 4.1 と画面設計 S-01b の例）', () => {
    expect(percentDiscountAmount(555, 15, 'floor')).toBe(83);
    expect(percentDiscountAmount(555, 15, 'ceil')).toBe(84);
    expect(percentDiscountAmount(555, 15, 'round10')).toBe(85);
  });

  it('割り切れるときは 3 方式とも同じ（10 円単位は 10 円未満を切り捨て）', () => {
    expect(percentDiscountAmount(1000, 20, 'floor')).toBe(200);
    expect(percentDiscountAmount(1000, 20, 'ceil')).toBe(200);
    expect(percentDiscountAmount(1000, 20, 'round10')).toBe(200);
  });

  it('0 円の商品は値引き 0 円', () => {
    for (const r of ['floor', 'ceil', 'round10'] as const) {
      expect(percentDiscountAmount(0, 50, r)).toBe(0);
    }
  });

  it('1% と 100%', () => {
    expect(percentDiscountAmount(555, 1, 'floor')).toBe(5);
    expect(percentDiscountAmount(555, 1, 'ceil')).toBe(6);
    expect(percentDiscountAmount(555, 1, 'round10')).toBe(15); // 549.45 円 → 540 円
    expect(percentDiscountAmount(555, 100, 'floor')).toBe(555);
    expect(percentDiscountAmount(555, 100, 'ceil')).toBe(555);
    expect(percentDiscountAmount(555, 100, 'round10')).toBe(555);
  });

  it('10 円未満の金額での 10 円単位は、値引き後 0 円になる', () => {
    expect(percentDiscountAmount(8, 10, 'round10')).toBe(8);
  });

  it('% が 1〜100 の整数でなければエラー', () => {
    expect(() => percentDiscountAmount(100, 0, 'floor')).toThrow(RangeError);
    expect(() => percentDiscountAmount(100, 101, 'floor')).toThrow(RangeError);
    expect(() => percentDiscountAmount(100, 12.5, 'floor')).toThrow(RangeError);
  });

  it('値引き額は対象金額を超えず、0 以上（1〜100% と 0〜2,000 円のすべて）', () => {
    for (let base = 0; base <= 2000; base += 7) {
      for (let p = 1; p <= 100; p++) {
        for (const r of ['floor', 'ceil', 'round10'] as const) {
          const d = percentDiscountAmount(base, p, r);
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(base);
        }
      }
    }
  });
});

describe('値引きの額', () => {
  it('値引きなしは 0', () => {
    expect(discountAmount(500, null)).toBe(0);
  });

  it('円の値引きは対象金額で止まる', () => {
    expect(discountAmount(500, { kind: 'yen', value: 100 })).toBe(100);
    expect(discountAmount(80, { kind: 'yen', value: 100 })).toBe(80);
  });

  it('% の値引きは選んだ端数処理で計算する', () => {
    expect(discountAmount(555, { kind: 'percent', value: 15, rounding: 'ceil' })).toBe(84);
  });
});
