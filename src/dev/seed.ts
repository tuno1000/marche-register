import { setCurrentEventId } from '../db/kv';
import { createCategory } from '../db/repositories/categories';
import { saveEvent } from '../db/repositories/events';
import { createProduct } from '../db/repositories/products';
import type { CategoryColor, TaxRate } from '../domain/types';
import { todayString } from '../lib/format';

/**
 * 開発用：ダミーのカテゴリ・商品・イベントを作る（05-実装計画 2 章）。
 * 開発用サーバーの設定画面だけに出すボタンから呼ぶ。
 */
export async function seedDummyData(): Promise<void> {
  const plan: {
    name: string;
    color: CategoryColor;
    products: [name: string, price: number, taxRate: TaxRate, tracksStock: boolean][];
  }[] = [
    {
      name: '焼き菓子',
      color: 'c2',
      products: [
        ['クッキー', 300, 8, true],
        ['マフィン', 450, 8, true],
        ['パウンドケーキ', 1200, 8, true],
        ['フィナンシェ', 250, 8, true],
      ],
    },
    {
      name: 'パン',
      color: 'c3',
      products: [
        ['食パン', 500, 8, true],
        ['あんぱん', 220, 8, true],
        ['ベーグル', 280, 8, false],
      ],
    },
    {
      name: '雑貨',
      color: 'c7',
      products: [
        ['エコバッグ', 1500, 10, true],
        ['ポストカード', 150, 10, false],
      ],
    },
  ];

  const stocks = new Map<string, number>();
  for (const c of plan) {
    const category = await createCategory({ name: c.name, color: c.color });
    for (const [name, price, taxRate, tracksStock] of c.products) {
      const p = await createProduct({
        name,
        price,
        taxRate,
        categoryId: category.id,
        tracksStock,
        isOnSale: true,
      });
      if (tracksStock) stocks.set(p.id, 10);
    }
  }
  const event = await saveEvent(
    null,
    { name: 'テストマルシェ', date: todayString(), location: '公園', memo: '' },
    stocks,
  );
  await setCurrentEventId(event.id);
}
