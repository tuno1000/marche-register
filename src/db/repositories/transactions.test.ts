import { beforeEach, describe, expect, it } from 'vitest';
import { isAppError } from '../../domain/errors';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { updateSettings } from '../kv';
import { db } from '../schema';
import { getCart, saveCart } from './cart';
import { setBroughtQty, soldQtyByProduct } from './events';
import { updateProduct } from './products';
import { checkout, listTransactions, voidTransaction, type CheckoutRequest } from './transactions';

beforeEach(resetDb);

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e) => isAppError(e) && e.code === code);
}

describe('会計の確定', () => {
  it('03 の 4.3 の例で取引が保存され、番号が振られ、カートが空になる', async () => {
    const { cookie, muffin, event } = await seedBasic();
    await updateSettings({ shopName: '○○焼き菓子店' });
    const req: CheckoutRequest = {
      eventId: event.id,
      lines: [
        {
          productId: cookie.id,
          qty: 2,
          discount: { kind: 'percent', value: 10, rounding: 'floor' },
        },
        { productId: muffin.id, qty: 1, discount: null },
      ],
      orderDiscount: { kind: 'yen', value: 100 },
      tendered: 1000,
    };
    await saveCart({
      eventId: event.id,
      lines: req.lines,
      orderDiscount: req.orderDiscount,
      updatedAt: 0,
    });

    const tx = await checkout(req);

    expect(tx.receiptNo).toBe('1103-001');
    expect(tx.total).toBe(890);
    expect(tx.change).toBe(110);
    expect(tx.taxes).toEqual([
      { rate: 8, taxableAmount: 485, taxAmount: 35 },
      { rate: 10, taxableAmount: 405, taxAmount: 36 },
    ]);
    expect(tx.lines[0]).toMatchObject({ productName: 'クッキー', categoryName: '焼き菓子' });
    expect(tx.receipt.shopName).toBe('○○焼き菓子店');
    expect(tx.eventName).toBe('○○マルシェ');
    expect(await db.transactions.get(tx.id)).toEqual(tx);
    expect((await db.events.get(event.id))?.nextSeq).toBe(2);
    expect(await getCart()).toBeNull();
  });

  it('あとで商品や店名を変えても、保存した取引は変わらない（スナップショット）', async () => {
    const { cookie, event } = await seedBasic();
    await updateSettings({ shopName: '旧店名' });
    const tx = await checkout({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 1, discount: null }],
      orderDiscount: null,
      tendered: 300,
    });
    await updateProduct(cookie.id, { name: '新クッキー', price: 999 });
    await updateSettings({ shopName: '新店名' });
    const saved = await db.transactions.get(tx.id);
    expect(saved?.lines[0]).toMatchObject({ productName: 'クッキー', unitPrice: 300 });
    expect(saved?.receipt.shopName).toBe('旧店名');
  });

  it('途中で失敗したら、取引も番号もカートも変わらない', async () => {
    const { cookie, event } = await seedBasic();
    const cart = {
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 1, discount: null }],
      orderDiscount: null,
      updatedAt: 0,
    };
    await saveCart(cart);
    // 取引を保存するところで失敗させる
    const fail = () => {
      throw new Error('保存に失敗');
    };
    db.transactions.hook('creating', fail);
    try {
      await expect(checkout({ ...cart, tendered: 300 })).rejects.toThrow('保存に失敗');
    } finally {
      db.transactions.hook('creating').unsubscribe(fail);
    }
    expect(await db.transactions.count()).toBe(0);
    expect((await db.events.get(event.id))?.nextSeq).toBe(1);
    expect(await getCart()).toEqual(cart);
  });

  it('在庫の残りより多くは確定できない', async () => {
    const { muffin, event } = await seedBasic();
    await expectCode(
      checkout({
        eventId: event.id,
        lines: [{ productId: muffin.id, qty: 4, discount: null }],
        orderDiscount: null,
        tendered: 10000,
      }),
      'OUT_OF_STOCK',
    );
  });

  it('同じ商品が複数の行にあるときは、合計で在庫を確かめる', async () => {
    const { muffin, event } = await seedBasic();
    await expectCode(
      checkout({
        eventId: event.id,
        lines: [
          { productId: muffin.id, qty: 2, discount: null },
          { productId: muffin.id, qty: 2, discount: null },
        ],
        orderDiscount: null,
        tendered: 10000,
      }),
      'OUT_OF_STOCK',
    );
  });

  it('在庫を管理しない商品は、持ち込み数がなくても売れる', async () => {
    const { cookie, event } = await seedBasic();
    await updateProduct(cookie.id, { tracksStock: false });
    const tx = await checkout({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 100, discount: null }],
      orderDiscount: null,
      tendered: 30000,
    });
    expect(tx.total).toBe(30000);
  });

  it('お預かりが足りなければ確定できない', async () => {
    const { cookie, event } = await seedBasic();
    await expectCode(
      checkout({
        eventId: event.id,
        lines: [{ productId: cookie.id, qty: 1, discount: null }],
        orderDiscount: null,
        tendered: 299,
      }),
      'INSUFFICIENT_TENDER',
    );
  });

  it('カートが空なら確定できない', async () => {
    const { event } = await seedBasic();
    await expectCode(
      checkout({ eventId: event.id, lines: [], orderDiscount: null, tendered: 0 }),
      'EMPTY_CART',
    );
  });
});

describe('取消と在庫', () => {
  it('取り消すと在庫が戻り、番号は使い回さない', async () => {
    const { muffin, event } = await seedBasic();
    const sell = (qty: number) =>
      checkout({
        eventId: event.id,
        lines: [{ productId: muffin.id, qty, discount: null }],
        orderDiscount: null,
        tendered: 10000,
      });

    const t1 = await sell(3);
    expect((await soldQtyByProduct(event.id)).get(muffin.id)).toBe(3);
    await expectCode(sell(1), 'OUT_OF_STOCK');

    await voidTransaction(t1.id);
    expect((await soldQtyByProduct(event.id)).get(muffin.id) ?? 0).toBe(0);

    const t2 = await sell(1);
    expect(t2.receiptNo).toBe('1103-002');
    const list = await listTransactions(event.id);
    expect(list.map((t) => [t.receiptNo, t.status])).toEqual([
      ['1103-002', 'valid'],
      ['1103-001', 'voided'],
    ]);
  });

  it('取り消した取引は、もう一度取り消せない', async () => {
    const { cookie, event } = await seedBasic();
    const tx = await checkout({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 1, discount: null }],
      orderDiscount: null,
      tendered: 300,
    });
    await voidTransaction(tx.id);
    await expectCode(voidTransaction(tx.id), 'ALREADY_VOIDED');
  });

  it('持ち込み数は販売数より少なくできない', async () => {
    const { cookie, event } = await seedBasic();
    await checkout({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 2, discount: null }],
      orderDiscount: null,
      tendered: 600,
    });
    await expectCode(setBroughtQty(event.id, cookie.id, 1), 'BELOW_SOLD_QTY');
    await setBroughtQty(event.id, cookie.id, 2);
    await setBroughtQty(event.id, cookie.id, 10);
  });
});
