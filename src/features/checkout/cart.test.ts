import { beforeEach, describe, expect, it } from 'vitest';
import { getCart } from '../../db/repositories/cart';
import type { Product } from '../../domain/types';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { cartQty, cartSaved, useCartStore } from './cartStore';
import { buildCartView, remainingStock } from './cartView';

beforeEach(resetDb);

const store = () => useCartStore.getState();

describe('カート（メモリと保存）', () => {
  it('追加・数量の変更が保存され、読み戻せる', async () => {
    store().add('e1', 'p1');
    store().add('e1', 'p1');
    store().add('e1', 'p2');
    expect(store().cart?.lines).toMatchObject([
      { productId: 'p1', qty: 2 },
      { productId: 'p2', qty: 1 },
    ]);
    expect(cartQty(store().cart)).toBe(3);
    await cartSaved();
    expect((await getCart())?.lines).toHaveLength(2);

    useCartStore.setState({ cart: null, loaded: false });
    await store().hydrate();
    expect(store().loaded).toBe(true);
    expect(store().cart?.lines.map((l) => l.qty)).toEqual([2, 1]);
  });

  it('金額を入力した行は、同じ商品でも単価ごとに別の行にする', () => {
    store().add('e1', 'p9', 500);
    store().add('e1', 'p9', 200);
    store().add('e1', 'p9', 500);
    expect(store().cart?.lines).toMatchObject([
      { productId: 'p9', unitPrice: 500, qty: 2 },
      { productId: 'p9', unitPrice: 200, qty: 1 },
    ]);
    store().setQty('p9@200', 0);
    store().setLineDiscount('p9@500', { kind: 'yen', value: 50 });
    expect(store().cart?.lines).toEqual([
      { productId: 'p9', unitPrice: 500, qty: 2, discount: { kind: 'yen', value: 50 } },
    ]);
  });

  it('行の単価を変えられる。同じ単価の行があればまとめ、undefined で登録した価格に戻す', () => {
    store().add('e1', 'p1');
    store().setLineDiscount('p1', { kind: 'yen', value: 10 });
    store().add('e1', 'p1', 250);
    store().setUnitPrice('p1', 200);
    expect(store().cart?.lines).toEqual([
      { productId: 'p1', unitPrice: 200, qty: 1, discount: { kind: 'yen', value: 10 } },
      { productId: 'p1', unitPrice: 250, qty: 1, discount: null },
    ]);
    // 250 の行を 200 に変えると、200 の行にまとまる（値引きはまとめ先のもの）
    store().setUnitPrice('p1@250', 200);
    expect(store().cart?.lines).toEqual([
      { productId: 'p1', unitPrice: 200, qty: 2, discount: { kind: 'yen', value: 10 } },
    ]);
    store().setUnitPrice('p1@200', undefined);
    expect(store().cart?.lines).toEqual([
      { productId: 'p1', qty: 2, discount: { kind: 'yen', value: 10 } },
    ]);
  });

  it('数量を 0 にすると行が消え、行がなくなるとカートごと消える', async () => {
    store().add('e1', 'p1');
    store().setOrderDiscount({ kind: 'yen', value: 10 });
    store().setQty('p1', 0);
    expect(store().cart).toBeNull();
    await cartSaved();
    expect(await getCart()).toBeNull();
  });

  it('別のイベントで追加したら、前のカートを捨てて新しく始める', () => {
    store().add('e1', 'p1');
    store().setOrderDiscount({ kind: 'yen', value: 10 });
    store().add('e2', 'p2');
    expect(store().cart).toMatchObject({
      eventId: 'e2',
      lines: [{ productId: 'p2', qty: 1 }],
      orderDiscount: null,
    });
  });

  it('読み戻している途中にタップしても、タップした内容が消えない', async () => {
    store().add('e1', 'p1');
    await cartSaved();
    const hydrating = store().hydrate();
    store().add('e1', 'p1');
    await hydrating;
    expect(store().cart?.lines[0]?.qty).toBe(2);
  });
});

describe('カートの金額', () => {
  it('03-データ設計 4.3 の計算例：合計 890 円', async () => {
    const { category, cookie, muffin, event } = await seedBasic();
    const view = buildCartView(
      {
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
        updatedAt: 0,
      },
      new Map([
        [cookie.id, cookie],
        [muffin.id, muffin],
      ]),
      new Map([[category.id, category]]),
    );
    expect(view.qty).toBe(3);
    expect(view.subtotal).toBe(990);
    expect(view.orderDiscountAmount).toBe(100);
    expect(view.total).toBe(890);
    expect(view.lines.map((l) => l.lineDiscountAmount)).toEqual([60, 0]);
  });

  it('削除された商品の行は、表示と計算から外す', async () => {
    const { category, cookie, muffin, event } = await seedBasic();
    const view = buildCartView(
      {
        eventId: event.id,
        lines: [
          { productId: cookie.id, qty: 1, discount: null },
          { productId: muffin.id, qty: 1, discount: null },
        ],
        orderDiscount: null,
        updatedAt: 0,
      },
      new Map<string, Product>([
        [cookie.id, { ...cookie, deletedAt: 1 }],
        [muffin.id, muffin],
      ]),
      new Map([[category.id, category]]),
    );
    expect(view.lines.map((l) => l.productName)).toEqual(['マフィン']);
    expect(view.total).toBe(450);
  });

  it('価格が空の商品は入力した単価で計算し、単価のない行は外す', async () => {
    const { category, cookie, event } = await seedBasic();
    const open: Product = { ...cookie, id: 'open', name: 'その他', price: null };
    const view = buildCartView(
      {
        eventId: event.id,
        lines: [
          { productId: 'open', unitPrice: 500, qty: 2, discount: null },
          { productId: 'open', qty: 1, discount: null },
          // 単価を入力したあとで商品に価格を付けても、入力した単価のまま
          { productId: cookie.id, unitPrice: 120, qty: 1, discount: null },
        ],
        orderDiscount: null,
        updatedAt: 0,
      },
      new Map<string, Product>([
        ['open', open],
        [cookie.id, cookie],
      ]),
      new Map([[category.id, category]]),
    );
    expect(view.lines.map((l) => [l.key, l.unitPrice, l.enteredPrice])).toEqual([
      ['open@500', 500, 500],
      [`${cookie.id}@120`, 120, 120],
    ]);
    expect(view.total).toBe(1120);
  });

  it('残りは、同じ商品の行の数量をすべて差し引く', async () => {
    const { cookie, event } = await seedBasic();
    const cart = {
      eventId: event.id,
      lines: [
        { productId: cookie.id, unitPrice: 100, qty: 2, discount: null },
        { productId: cookie.id, unitPrice: 200, qty: 1, discount: null },
      ],
      orderDiscount: null,
      updatedAt: 0,
    };
    expect(remainingStock(cookie, new Map([[cookie.id, 5]]), new Map(), cart)).toBe(2);
  });

  it('残りは、持ち込み数 − 販売数 − カートに入れた数。在庫を管理しない商品は null', async () => {
    const { cookie, event } = await seedBasic();
    const brought = new Map([[cookie.id, 5]]);
    const sold = new Map([[cookie.id, 1]]);
    const cart = {
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 2, discount: null }],
      orderDiscount: null,
      updatedAt: 0,
    };
    expect(remainingStock(cookie, brought, sold, cart)).toBe(2);
    expect(remainingStock(cookie, new Map(), sold, null)).toBe(-1);
    expect(remainingStock({ ...cookie, tracksStock: false }, brought, sold, cart)).toBeNull();
  });
});
