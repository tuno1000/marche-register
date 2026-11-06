import { describe, expect, it } from 'vitest';
import { calculateCheckout } from './checkout';
import { summarizeEvent, summarizeProducts } from './summary';
import type { Transaction } from './types';

let seq = 0;
function tx(
  items: { id: string; name: string; price: number; rate: 8 | 10; qty: number }[],
  opts: { status?: 'valid' | 'voided'; createdAt?: number; orderDiscountYen?: number } = {},
): Transaction {
  const r = calculateCheckout(
    items.map((i) => ({
      productId: i.id,
      productName: i.name,
      categoryName: 'c',
      unitPrice: i.price,
      taxRate: i.rate,
      qty: i.qty,
      discount: null,
    })),
    opts.orderDiscountYen ? { kind: 'yen', value: opts.orderDiscountYen } : null,
  );
  seq += 1;
  return {
    id: `t${seq}`,
    eventId: 'e1',
    seq,
    receiptNo: `1103-${seq}`,
    createdAt: opts.createdAt ?? seq,
    status: opts.status ?? 'valid',
    voidedAt: null,
    eventName: 'マルシェ',
    eventDate: '2026-11-03',
    receipt: { shopName: '', invoiceNo: '', contact: '', links: [], footer: '' },
    orderDiscount: null,
    tendered: r.total,
    change: 0,
    ...r,
  };
}

const cookie = { id: 'p1', name: 'クッキー', price: 300, rate: 8 as const };
const muffin = { id: 'p2', name: 'マフィン', price: 450, rate: 10 as const };

describe('イベント別の集計', () => {
  it('取り消した取引を含めない', () => {
    const s = summarizeEvent([
      tx([{ ...cookie, qty: 2 }]),
      tx([{ ...muffin, qty: 1 }], { orderDiscountYen: 50 }),
      tx([{ ...muffin, qty: 3 }], { status: 'voided' }),
    ]);
    expect(s.salesTotal).toBe(1000);
    expect(s.transactionCount).toBe(2);
    expect(s.averagePerCustomer).toBe(500);
    expect(s.discountTotal).toBe(50);
    expect(s.voidedCount).toBe(1);
    expect(s.taxes).toEqual([
      { rate: 8, taxableAmount: 600, taxAmount: 44 },
      { rate: 10, taxableAmount: 400, taxAmount: 36 },
    ]);
  });

  it('客単価は 1 円未満を四捨五入', () => {
    const t = (price: number) => tx([{ ...cookie, price, qty: 1 }]);
    expect(summarizeEvent([t(100), t(101)]).averagePerCustomer).toBe(101); // 100.5
    expect(summarizeEvent([t(100), t(100), t(101)]).averagePerCustomer).toBe(100); // 100.33
  });

  it('内税は取引ごとに出した額の合計（合計額から計算し直さない）', () => {
    // 100 円（内税 7）× 3 件 → 内税 21。合計 300 円から計算すると 22 になる
    const t = () => tx([{ ...cookie, price: 100, qty: 1 }]);
    expect(summarizeEvent([t(), t(), t()]).taxes).toEqual([
      { rate: 8, taxableAmount: 300, taxAmount: 21 },
    ]);
  });

  it('0 件のとき', () => {
    const s = summarizeEvent([]);
    expect(s.salesTotal).toBe(0);
    expect(s.averagePerCustomer).toBeNull();
    expect(s.taxes).toEqual([]);
  });
});

describe('商品別の集計', () => {
  const list = [
    tx([{ ...cookie, qty: 5 }], { createdAt: 1 }),
    tx(
      [
        { ...muffin, qty: 2 },
        { ...cookie, name: 'クッキー（新）', qty: 1 },
      ],
      { createdAt: 2 },
    ),
    tx([{ ...muffin, qty: 10 }], { status: 'voided', createdAt: 3 }),
  ];

  it('数量順', () => {
    expect(summarizeProducts(list, 'qty')).toEqual([
      { productId: 'p1', productName: 'クッキー（新）', qty: 6, amount: 1800 },
      { productId: 'p2', productName: 'マフィン', qty: 2, amount: 900 },
    ]);
  });

  it('金額には全体値引きの按分を反映する', () => {
    const rows = summarizeProducts(
      [
        tx(
          [
            { ...cookie, qty: 1 },
            { ...muffin, qty: 1 },
          ],
          { orderDiscountYen: 75 },
        ),
      ],
      'amount',
    );
    expect(rows.map((r) => r.amount)).toEqual([405, 270]);
  });
});
