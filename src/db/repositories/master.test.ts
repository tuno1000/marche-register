import { beforeEach, describe, expect, it } from 'vitest';
import { isAppError } from '../../domain/errors';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { getCurrentEventId, getSettings, setCurrentEventId, updateSettings } from '../kv';
import { db } from '../schema';
import { getCart, saveCart } from './cart';
import { createCategory, deleteCategory, listCategories, moveCategory } from './categories';
import { deleteEvent, listEventStocks, listEvents, createEvent } from './events';
import {
  createProduct,
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
      blob: new Blob(['x'], { type: 'image/jpeg' }),
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
