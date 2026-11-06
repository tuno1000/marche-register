import { createCategory } from '../db/repositories/categories';
import { createEvent, setBroughtQty } from '../db/repositories/events';
import { createProduct, type ProductInput } from '../db/repositories/products';

/** テスト用：カテゴリ、商品 2 つ、イベントを作る */
export async function seedBasic() {
  const category = await createCategory({ name: '焼き菓子', color: 'c1' });
  const product = (input: Partial<ProductInput> & { name: string; price: number }) =>
    createProduct({
      taxRate: 8,
      categoryId: category.id,
      tracksStock: true,
      isOnSale: true,
      ...input,
    });
  const cookie = await product({ name: 'クッキー', price: 300 });
  const muffin = await product({ name: 'マフィン', price: 450, taxRate: 10 });
  const event = await createEvent({
    name: '○○マルシェ',
    date: '2026-11-03',
    location: '',
    memo: '',
  });
  await setBroughtQty(event.id, cookie.id, 5);
  await setBroughtQty(event.id, muffin.id, 3);
  return { category, cookie, muffin, event };
}
