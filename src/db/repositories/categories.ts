import { AppError } from '../../domain/errors';
import type { Category, CategoryColor, Id } from '../../domain/types';
import { newId } from '../../lib/id';
import { db } from '../schema';
import { validColor, validName } from '../validate';

export interface CategoryInput {
  name: string;
  color: CategoryColor;
}

/** 並び順どおりのカテゴリ */
export async function listCategories(): Promise<Category[]> {
  return db.categories.orderBy('sortOrder').toArray();
}

/** カテゴリごとの商品数（削除した商品は数えない） */
export async function countProductsByCategory(): Promise<Map<Id, number>> {
  const counts = new Map<Id, number>();
  await db.products.each((p) => {
    if (p.deletedAt === null) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
  });
  return counts;
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const name = validName(input.name, 20, 'カテゴリ名');
  const color = validColor(input.color);
  return db.transaction('rw', db.categories, async () => {
    const last = await db.categories.orderBy('sortOrder').last();
    const now = Date.now();
    const category: Category = {
      id: newId(),
      name,
      color,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.categories.add(category);
    return category;
  });
}

export async function updateCategory(id: Id, input: Partial<CategoryInput>): Promise<void> {
  const patch: Partial<Category> = { updatedAt: Date.now() };
  if (input.name !== undefined) patch.name = validName(input.name, 20, 'カテゴリ名');
  if (input.color !== undefined) patch.color = validColor(input.color);
  const count = await db.categories.update(id, patch);
  if (count === 0) throw new AppError('NOT_FOUND', 'カテゴリが見つかりません');
}

/** 1 つ前（-1）か後（+1）と入れ替える */
export async function moveCategory(id: Id, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const list = await db.categories.orderBy('sortOrder').toArray();
    const i = list.findIndex((c) => c.id === id);
    const j = i + direction;
    const a = list[i];
    const b = list[j];
    if (!a || !b) return;
    await db.categories.update(a.id, { sortOrder: b.sortOrder });
    await db.categories.update(b.id, { sortOrder: a.sortOrder });
  });
}

/** 削除していない商品が 1 つでもあれば削除しない（要件定義 F-01） */
export async function deleteCategory(id: Id): Promise<void> {
  await db.transaction('rw', db.categories, db.products, async () => {
    const inUse = await db.products
      .where('categoryId')
      .equals(id)
      .filter((p) => p.deletedAt === null)
      .count();
    if (inUse > 0) {
      throw new AppError('CATEGORY_IN_USE', '先に商品を別のカテゴリへ移してください');
    }
    await db.categories.delete(id);
  });
}
