import { describe, expect, it } from 'vitest';
import { seededRandom } from '../test/random';
import { calculateCheckout, includedTax, type CheckoutLineInput } from './checkout';
import type { Discount, Rounding, TaxRate } from './types';

function line(
  name: string,
  unitPrice: number,
  taxRate: TaxRate,
  qty: number,
  discount: Discount | null = null,
): CheckoutLineInput {
  return {
    productId: name,
    productName: name,
    categoryName: 'カテゴリ',
    unitPrice,
    taxRate,
    qty,
    discount,
  };
}

describe('1 取引の計算（03 の 4.2）', () => {
  it('03 の 4.3 の計算例（画面設計 S-02 のレシート）', () => {
    const r = calculateCheckout(
      [
        line('クッキー', 300, 8, 2, { kind: 'percent', value: 10, rounding: 'floor' }),
        line('マフィン', 450, 10, 1),
      ],
      { kind: 'yen', value: 100 },
    );
    expect(
      r.lines.map((l) => [l.grossAmount, l.lineDiscountAmount, l.orderDiscountShare, l.netAmount]),
    ).toEqual([
      [600, 60, 55, 485],
      [450, 0, 45, 405],
    ]);
    expect(r.subtotal).toBe(990);
    expect(r.orderDiscountAmount).toBe(100);
    expect(r.total).toBe(890);
    expect(r.taxes).toEqual([
      { rate: 8, taxableAmount: 485, taxAmount: 35 },
      { rate: 10, taxableAmount: 405, taxAmount: 36 },
    ]);
  });

  it('8% だけの取引', () => {
    const r = calculateCheckout([line('クッキー', 300, 8, 3)], null);
    expect(r.total).toBe(900);
    expect(r.taxes).toEqual([{ rate: 8, taxableAmount: 900, taxAmount: 66 }]);
  });

  it('10% だけの取引', () => {
    const r = calculateCheckout([line('雑貨', 1100, 10, 1)], null);
    expect(r.taxes).toEqual([{ rate: 10, taxableAmount: 1100, taxAmount: 100 }]);
  });

  it('税率ごとの合計が同じなら、余りは 10% に行く', () => {
    const r = calculateCheckout([line('A', 500, 8, 1), line('B', 500, 10, 1)], {
      kind: 'yen',
      value: 101,
    });
    expect(r.lines.map((l) => l.orderDiscountShare)).toEqual([50, 51]);
  });

  it('税率の中では、余りは金額の大きい明細から。同じ額なら行番号の小さい明細', () => {
    const r = calculateCheckout(
      [line('A', 100, 8, 1), line('B', 300, 8, 1), line('C', 100, 8, 1)],
      { kind: 'yen', value: 3 },
    );
    // 3 × 100/500 = 0.6、3 × 300/500 = 1.8、0.6 → 0, 1, 0、余り 2 → B, A
    expect(r.lines.map((l) => l.orderDiscountShare)).toEqual([1, 2, 0]);
  });

  it('全体値引きの % は、明細値引き後の合計に対して計算する', () => {
    const r = calculateCheckout([line('A', 555, 8, 1, { kind: 'yen', value: 55 })], {
      kind: 'percent',
      value: 10,
      rounding: 'round10',
    });
    expect(r.subtotal).toBe(500);
    expect(r.orderDiscountAmount).toBe(50);
    expect(r.total).toBe(450);
  });

  it('値引きで 0 円になる取引', () => {
    const r = calculateCheckout([line('A', 300, 8, 1)], {
      kind: 'percent',
      value: 100,
      rounding: 'floor',
    });
    expect(r.total).toBe(0);
    expect(r.taxes).toEqual([{ rate: 8, taxableAmount: 0, taxAmount: 0 }]);
  });

  it('数量が 1 未満ならエラー', () => {
    expect(() => calculateCheckout([line('A', 300, 8, 0)], null)).toThrow(RangeError);
  });
});

describe('内消費税', () => {
  it('1 円未満は切り捨て', () => {
    expect(includedTax(485, 8)).toBe(35); // 35.92..
    expect(includedTax(405, 10)).toBe(36); // 36.81..
    expect(includedTax(108, 8)).toBe(8);
    expect(includedTax(110, 10)).toBe(10);
  });
});

describe('必ず成り立つこと（ランダムな 1,000 通りの取引）', () => {
  const rand = seededRandom(20261106);
  const roundings: Rounding[] = ['floor', 'ceil', 'round10'];
  const randomDiscount = (): Discount | null => {
    if (rand.chance(0.5)) return null;
    return rand.chance(0.5)
      ? { kind: 'yen', value: rand.int(0, 3000) }
      : { kind: 'percent', value: rand.int(1, 100), rounding: rand.pick(roundings) };
  };

  for (let n = 0; n < 1000; n++) {
    const inputs = Array.from({ length: rand.int(1, 8) }, (_, i) =>
      line(
        `P${i}`,
        rand.pick([0, 50, 100, 150, 280, 300, 450, 555, 1200, 3800]),
        rand.pick([8, 10] as const),
        rand.int(1, 5),
        randomDiscount(),
      ),
    );
    const orderDiscount = randomDiscount();

    it(`取引 ${n + 1}`, () => {
      const r = calculateCheckout(inputs, orderDiscount);
      const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
      // ① netAmount が 0 以上
      for (const l of r.lines) expect(l.netAmount).toBeGreaterThanOrEqual(0);
      // ② netAmount の合計 ＝ total
      expect(sum(r.lines.map((l) => l.netAmount))).toBe(r.total);
      // ③ 税率別の対象額の合計 ＝ total
      expect(sum(r.taxes.map((t) => t.taxableAmount))).toBe(r.total);
      // ④ 按分額の合計 ＝ 全体値引きの額
      expect(sum(r.lines.map((l) => l.orderDiscountShare))).toBe(r.orderDiscountAmount);
      // 金額はすべて整数
      for (const l of r.lines) {
        for (const v of [l.grossAmount, l.lineDiscountAmount, l.orderDiscountShare, l.netAmount]) {
          expect(Number.isInteger(v)).toBe(true);
        }
      }
    });
  }
});
