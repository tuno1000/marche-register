import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import {
  getCurrentEventId,
  getKv,
  getSettings,
  setCurrentEventId,
  setKv,
  updateSettings,
} from '../kv';
import { db } from '../schema';
import { createBackup, deleteAllData, restoreBackup } from './backup';
import { getCart, saveCart } from './cart';
import { createCategory } from './categories';
import { setProductImage } from './products';
import { checkout } from './transactions';

beforeEach(resetDb);

async function seedWithSale() {
  const seed = await seedBasic();
  await setCurrentEventId(seed.event.id);
  await updateSettings({ shopName: '○○焼き菓子店' });
  await setProductImage({
    productId: seed.cookie.id,
    data: new Uint8Array([1, 2, 3, 250]).buffer,
    type: 'image/jpeg',
    width: 400,
    height: 300,
  });
  await checkout({
    eventId: seed.event.id,
    lines: [{ productId: seed.cookie.id, qty: 1, discount: null }],
    orderDiscount: null,
    tendered: 300,
  });
  return seed;
}

describe('バックアップと復元', () => {
  it('バックアップ → 全データ削除 → 復元で、元のデータに戻る（カートは含めない）', async () => {
    const seed = await seedWithSale();
    await saveCart({ eventId: seed.event.id, lines: [], orderDiscount: null, updatedAt: 0 });
    await setKv('installWarningDismissed', true);
    const backup = JSON.parse(JSON.stringify(await createBackup('0.5.0')));
    expect(backup.counts).toEqual({ categories: 1, products: 2, events: 1, transactions: 1 });

    await deleteAllData();
    expect(await db.products.count()).toBe(0);
    expect((await getSettings()).shopName).toBe(''); // 初期値に戻る
    expect(await getCurrentEventId()).toBeNull();
    expect(await getKv('installWarningDismissed')).toBe(true); // 端末の状態は残す

    await restoreBackup(backup);
    expect(await db.categories.count()).toBe(1);
    expect(await db.products.count()).toBe(2);
    expect(await db.transactions.count()).toBe(1);
    expect(await db.eventStocks.count()).toBe(2);
    expect((await getSettings()).shopName).toBe('○○焼き菓子店');
    expect(await getCurrentEventId()).toBe(seed.event.id);
    expect(await getCart()).toBeNull();
    const image = await db.productImages.get(seed.cookie.id);
    expect(new Uint8Array(image!.data)).toEqual(new Uint8Array([1, 2, 3, 250]));
    expect(image!.type).toBe('image/jpeg');
  });

  it('復元は今のデータをすべて置き換える', async () => {
    await seedWithSale();
    const backup = await createBackup('0.5.0');
    await createCategory({ name: 'あとから追加', color: 'c2' });
    await restoreBackup(backup);
    expect((await db.categories.toArray()).map((c) => c.name)).toEqual(['焼き菓子']);
  });

  it('途中で失敗したら、元のデータのまま残る', async () => {
    await seedWithSale();
    const backup = await createBackup('0.5.0');
    const before = await db.categories.toArray();
    // 同じ ID の取引が 2 つある、壊れたバックアップ
    const broken = {
      ...backup,
      data: {
        ...backup.data,
        transactions: [...backup.data.transactions, ...backup.data.transactions],
      },
    };
    await expect(restoreBackup(broken)).rejects.toBeTruthy();
    expect(await db.categories.toArray()).toEqual(before);
    expect(await db.transactions.count()).toBe(1);
  });
});
