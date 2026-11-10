import { beforeEach, describe, expect, it } from 'vitest';
import { isAppError } from '../../domain/errors';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { getCurrentEventId, getSettings, setCurrentEventId, updateSettings } from '../kv';
import { db } from '../schema';
import { getCart, saveCart } from './cart';
import {
  countProductsByCategory,
  createCategory,
  deleteCategory,
  listCategories,
  moveCategory,
} from './categories';
import { deleteEvent, listEventStocks, listEvents, createEvent, saveEvent } from './events';
import {
  createProduct,
  defaultCategoryIdForNewProduct,
  defaultTaxRateFor,
  deleteProduct,
  getProduct,
  listProducts,
  moveProduct,
  removeProductImage,
  setProductImage,
  updateProduct,
} from './products';
import { checkout, voidTransaction } from './transactions';

beforeEach(resetDb);

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e) => isAppError(e) && e.code === code);
}

describe('設定', () => {
  it('保存していなければ初期値（値引きの定型ボタン 4 つ）', async () => {
    const s = await getSettings();
    expect(s.defaultRounding).toBe('floor');
    expect(s.theme).toBe('light');
    expect(s.discountPresets.map((p) => p.label)).toEqual([
      '50円引き',
      '100円引き',
      '10%引き',
      '20%引き',
    ]);
    // 何度読んでも同じ ID
    expect((await getSettings()).discountPresets).toEqual(s.discountPresets);
  });

  it('一部だけ変えられる', async () => {
    await updateSettings({ shopName: '店' });
    await updateSettings({ theme: 'dark' });
    expect(await getSettings()).toMatchObject({ shopName: '店', theme: 'dark' });
  });
});

describe('カテゴリ', () => {
  it('追加した順に並び、入れ替えられる', async () => {
    const a = await createCategory({ name: 'A', color: 'c1' });
    const b = await createCategory({ name: 'B', color: 'c2' });
    expect((await listCategories()).map((c) => c.name)).toEqual(['A', 'B']);
    await moveCategory(b.id, -1);
    expect((await listCategories()).map((c) => c.name)).toEqual(['B', 'A']);
    await moveCategory(b.id, -1); // 先頭より前はない
    expect((await listCategories()).map((c) => c.id)).toEqual([b.id, a.id]);
  });

  it('名前が空や長すぎるとエラー', async () => {
    await expectCode(createCategory({ name: '  ', color: 'c1' }), 'INVALID_INPUT');
    await expectCode(createCategory({ name: 'あ'.repeat(21), color: 'c1' }), 'INVALID_INPUT');
  });

  it('削除していない商品があれば削除できない。削除した商品だけなら削除できる', async () => {
    const { category, cookie, muffin } = await seedBasic();
    await expectCode(deleteCategory(category.id), 'CATEGORY_IN_USE');
    await deleteProduct(cookie.id);
    await deleteProduct(muffin.id);
    await deleteCategory(category.id);
    expect(await listCategories()).toEqual([]);
  });
});

describe('商品', () => {
  it('価格は 0 以上の整数、税率は 8 か 10', async () => {
    const c = await createCategory({ name: 'A', color: 'c1' });
    const base = {
      name: 'X',
      taxRate: 8 as const,
      categoryId: c.id,
      tracksStock: false,
      isOnSale: true,
    };
    await expectCode(createProduct({ ...base, price: -1 }), 'INVALID_INPUT');
    await expectCode(createProduct({ ...base, price: 1.5 }), 'INVALID_INPUT');
    await expectCode(createProduct({ ...base, price: 100, taxRate: 5 as 8 }), 'INVALID_INPUT');
    await expectCode(createProduct({ ...base, price: 100, categoryId: 'none' }), 'INVALID_INPUT');
    expect((await createProduct({ ...base, price: 0 })).price).toBe(0);
    expect((await createProduct({ ...base, price: null })).price).toBeNull();
  });

  it('削除すると一覧から消え、カートからも外れる。過去の取引の商品名は残る', async () => {
    const { cookie, muffin, event } = await seedBasic();
    const tx = await checkout({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 1, discount: null }],
      orderDiscount: null,
      tendered: 300,
    });
    await saveCart({
      eventId: event.id,
      lines: [
        { productId: cookie.id, qty: 1, discount: null },
        { productId: muffin.id, qty: 1, discount: null },
      ],
      orderDiscount: null,
      updatedAt: 0,
    });

    await deleteProduct(cookie.id);

    expect((await listProducts()).map((p) => p.name)).toEqual(['マフィン']);
    expect((await getCart())?.lines.map((l) => l.productId)).toEqual([muffin.id]);
    expect((await db.transactions.get(tx.id))?.lines[0]?.productName).toBe('クッキー');
    await expectCode(updateProduct(cookie.id, { price: 1 }), 'NOT_FOUND');
  });

  it('カテゴリの中で入れ替えられる。カテゴリを変えると移った先の最後に並ぶ', async () => {
    const { cookie, muffin } = await seedBasic();
    await moveProduct(muffin.id, -1);
    expect((await listProducts()).map((p) => p.name)).toEqual(['マフィン', 'クッキー']);

    const other = await createCategory({ name: 'パン', color: 'c2' });
    const bread = await createProduct({
      name: 'パン',
      price: 200,
      taxRate: 8,
      categoryId: other.id,
      tracksStock: false,
      isOnSale: true,
    });
    await updateProduct(cookie.id, { categoryId: other.id });
    const moved = await getProduct(cookie.id);
    expect(moved?.categoryId).toBe(other.id);
    expect(moved!.sortOrder).toBeGreaterThan(bread.sortOrder);
  });

  it('画像を付けると hasImage が true、外すと false', async () => {
    const { cookie } = await seedBasic();
    await setProductImage({
      productId: cookie.id,
      data: new Uint8Array([1, 2, 3]).buffer,
      type: 'image/jpeg',
      width: 400,
      height: 300,
    });
    expect((await getProduct(cookie.id))?.hasImage).toBe(true);
    expect(await db.productImages.get(cookie.id)).toMatchObject({ width: 400, height: 300 });
    await removeProductImage(cookie.id);
    expect((await getProduct(cookie.id))?.hasImage).toBe(false);
    expect(await db.productImages.get(cookie.id)).toBeUndefined();
  });
});

describe('イベント', () => {
  it('開催日の新しい順', async () => {
    const make = (name: string, date: string) =>
      createEvent({ name, date, location: '', memo: '' });
    await make('A', '2026-10-01');
    await make('B', '2026-11-03');
    await make('C', '2026-09-15');
    expect((await listEvents()).map((e) => e.name)).toEqual(['B', 'A', 'C']);
  });

  it('開催日が正しくなければエラー', async () => {
    await expectCode(
      createEvent({ name: 'A', date: '2026-02-30', location: '', memo: '' }),
      'INVALID_INPUT',
    );
    await expectCode(
      createEvent({ name: 'A', date: '2026/11/03', location: '', memo: '' }),
      'INVALID_INPUT',
    );
  });

  it('会計したことのないイベントは削除でき、持ち込み在庫・現在のイベント・カートも片付く', async () => {
    const { cookie, event } = await seedBasic();
    await setCurrentEventId(event.id);
    await saveCart({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 1, discount: null }],
      orderDiscount: null,
      updatedAt: 0,
    });

    await deleteEvent(event.id);

    expect(await listEvents()).toEqual([]);
    expect(await listEventStocks(event.id)).toEqual([]);
    expect(await getCurrentEventId()).toBeNull();
    expect(await getCart()).toBeNull();
  });

  it('取引があれば（取り消した取引だけでも）削除できない', async () => {
    const { cookie, event } = await seedBasic();
    const tx = await checkout({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 1, discount: null }],
      orderDiscount: null,
      tendered: 300,
    });
    await voidTransaction(tx.id);
    await expectCode(deleteEvent(event.id), 'EVENT_HAS_TRANSACTIONS');
  });
});

describe('M2 の画面から使う読み書き', () => {
  const image = (w: number) => ({
    data: new Uint8Array([1, 2, 3]).buffer,
    type: 'image/jpeg',
    width: w,
    height: 100,
  });

  it('商品の追加と変更で、画像も一緒に保存・差し替え・削除できる', async () => {
    const c = await createCategory({ name: 'A', color: 'c1' });
    const p = await createProduct(
      { name: 'X', price: 100, taxRate: 8, categoryId: c.id, tracksStock: false, isOnSale: true },
      image(400),
    );
    expect(p.hasImage).toBe(true);
    expect((await db.productImages.get(p.id))?.width).toBe(400);

    await updateProduct(p.id, { price: 200 }); // 画像はそのまま
    expect((await db.productImages.get(p.id))?.width).toBe(400);

    await updateProduct(p.id, {}, image(300));
    expect((await db.productImages.get(p.id))?.width).toBe(300);

    await updateProduct(p.id, {}, null);
    expect((await getProduct(p.id))?.hasImage).toBe(false);
    expect(await db.productImages.get(p.id)).toBeUndefined();
  });

  it('入力が正しくなければ、画像も保存しない', async () => {
    const c = await createCategory({ name: 'A', color: 'c1' });
    await expectCode(
      createProduct(
        { name: '', price: 100, taxRate: 8, categoryId: c.id, tracksStock: false, isOnSale: true },
        image(400),
      ),
      'INVALID_INPUT',
    );
    expect(await db.productImages.count()).toBe(0);
  });

  it('新しい商品の初期値：直前に登録した商品のカテゴリと、そのカテゴリの直前の商品の税率', async () => {
    expect(await defaultCategoryIdForNewProduct()).toBeNull();
    const a = await createCategory({ name: 'A', color: 'c1' });
    const b = await createCategory({ name: 'B', color: 'c2' });
    expect(await defaultCategoryIdForNewProduct()).toBe(a.id); // 商品がなければ先頭
    expect(await defaultTaxRateFor(b.id)).toBe(8); // 商品がなければ 8%

    const base = { price: 100, tracksStock: false, isOnSale: true };
    await createProduct({ ...base, name: 'X', taxRate: 8, categoryId: a.id });
    await new Promise((r) => setTimeout(r, 2));
    await createProduct({ ...base, name: 'Y', taxRate: 10, categoryId: b.id });
    expect(await defaultCategoryIdForNewProduct()).toBe(b.id);
    expect(await defaultTaxRateFor(b.id)).toBe(10);
    expect(await defaultTaxRateFor(a.id)).toBe(8);
  });

  it('カテゴリごとの商品数は、削除した商品を数えない', async () => {
    const { category, cookie } = await seedBasic();
    expect((await countProductsByCategory()).get(category.id)).toBe(2);
    await deleteProduct(cookie.id);
    expect((await countProductsByCategory()).get(category.id)).toBe(1);
  });

  it('イベントを新しく作ると、現在のイベントが未選択なら現在のイベントになる', async () => {
    const input = { name: 'A', date: '2026-11-03', location: '', memo: '' };
    const a = await saveEvent(null, input);
    expect(await getCurrentEventId()).toBe(a.id);
    await saveEvent(null, { ...input, name: 'B' });
    expect(await getCurrentEventId()).toBe(a.id); // 選んであれば変えない
  });

  it('イベントと持ち込み数をまとめて保存する。変わっていない商品と、0 のままの商品は書かない', async () => {
    const { cookie, muffin, event } = await seedBasic(); // クッキー 5、マフィン 3
    const before = await listEventStocks(event.id);
    const extra = await createProduct({
      name: 'パン',
      price: 200,
      taxRate: 8,
      categoryId: cookie.categoryId,
      tracksStock: true,
      isOnSale: true,
    });

    await saveEvent(
      event.id,
      { name: '新しい名前', date: '2026-11-04', location: '駅前', memo: '' },
      new Map([
        [cookie.id, 8],
        [muffin.id, 3],
        [extra.id, 0],
      ]),
    );

    expect(await db.events.get(event.id)).toMatchObject({ name: '新しい名前', location: '駅前' });
    const after = await listEventStocks(event.id);
    expect(after.find((s) => s.productId === cookie.id)?.broughtQty).toBe(8);
    // マフィンは変わっていないので、前の行のまま
    expect(after.find((s) => s.productId === muffin.id)).toEqual(
      before.find((s) => s.productId === muffin.id),
    );
    expect(after.some((s) => s.productId === extra.id)).toBe(false);
  });

  it('販売数より少ない持ち込み数があれば、イベントも在庫も何も保存しない', async () => {
    const { cookie, muffin, event } = await seedBasic();
    await checkout({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 3, discount: null }],
      orderDiscount: null,
      tendered: 900,
    });
    await expectCode(
      saveEvent(
        event.id,
        { name: '変更', date: '2026-11-03', location: '', memo: '' },
        new Map([
          [muffin.id, 9],
          [cookie.id, 2],
        ]),
      ),
      'BELOW_SOLD_QTY',
    );
    expect((await db.events.get(event.id))?.name).toBe('○○マルシェ');
    expect(
      (await listEventStocks(event.id)).find((s) => s.productId === muffin.id)?.broughtQty,
    ).toBe(3);
    // 販売数ちょうどなら保存できる
    await saveEvent(
      event.id,
      { name: '変更', date: '2026-11-03', location: '', memo: '' },
      new Map([[cookie.id, 3]]),
    );
  });
});
