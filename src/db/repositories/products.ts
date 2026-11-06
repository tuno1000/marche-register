import { AppError } from '../../domain/errors';
import type { Id, Product, ProductImage, TaxRate } from '../../domain/types';
import { newId } from '../../lib/id';
import { db } from '../schema';
import { validName, validNonNegativeInt, validTaxRate } from '../validate';
import { removeProductFromCart } from './cart';

export interface ProductInput {
  name: string;
  price: number;
  taxRate: TaxRate;
  categoryId: Id;
  tracksStock: boolean;
  isOnSale: boolean;
}

/** 削除していない商品（並び順どおり。カテゴリごとのまとめは画面側で行う） */
export async function listProducts(): Promise<Product[]> {
  const all = await db.products.orderBy('sortOrder').toArray();
  return all.filter((p) => p.deletedAt === null);
}

export async function getProduct(id: Id): Promise<Product | undefined> {
  return db.products.get(id);
}

/** 商品画像の中身（商品 ID 以外） */
export type ProductImageData = Omit<ProductImage, 'productId'>;

/** 商品を追加する。画像も渡せば、同じトランザクションで保存する */
export async function createProduct(
  input: ProductInput,
  image?: ProductImageData,
): Promise<Product> {
  const fields = validate(input);
  return db.transaction('rw', db.products, db.categories, db.productImages, async () => {
    await assertCategoryExists(fields.categoryId);
    const now = Date.now();
    const product: Product = {
      id: newId(),
      ...fields,
      hasImage: image !== undefined,
      deletedAt: null,
      sortOrder: await nextSortOrder(fields.categoryId),
      createdAt: now,
      updatedAt: now,
    };
    await db.products.add(product);
    if (image) await db.productImages.put({ productId: product.id, ...image });
    return product;
  });
}

/**
 * 商品を変える。画像は、undefined ならそのまま、null なら外し、値を渡せば差し替える
 * （同じトランザクションで保存する）
 */
export async function updateProduct(
  id: Id,
  input: Partial<ProductInput>,
  image?: ProductImageData | null,
): Promise<void> {
  await db.transaction('rw', db.products, db.categories, db.productImages, async () => {
    const current = await db.products.get(id);
    if (!current || current.deletedAt !== null) {
      throw new AppError('NOT_FOUND', '商品が見つかりません');
    }
    const fields = validate({ ...current, ...input });
    const patch: Partial<Product> = { ...fields, updatedAt: Date.now() };
    if (fields.categoryId !== current.categoryId) {
      await assertCategoryExists(fields.categoryId);
      // カテゴリを変えたら、移った先の最後に並べる
      patch.sortOrder = await nextSortOrder(fields.categoryId);
    }
    if (image === null) {
      patch.hasImage = false;
      await db.productImages.delete(id);
    } else if (image !== undefined) {
      patch.hasImage = true;
      await db.productImages.put({ productId: id, ...image });
    }
    await db.products.update(id, patch);
  });
}

/**
 * 新しい商品の税率の初期値：同じカテゴリで直前に登録した商品に合わせる。なければ 8%（02-画面設計 S-05b）
 */
export async function defaultTaxRateFor(categoryId: Id): Promise<TaxRate> {
  const list = await db.products.where('categoryId').equals(categoryId).toArray();
  const last = list
    .filter((p) => p.deletedAt === null)
    .reduce<Product | undefined>((a, p) => (!a || p.createdAt >= a.createdAt ? p : a), undefined);
  return last?.taxRate ?? 8;
}

/** 新しい商品のカテゴリの初期値：直前に登録した商品のカテゴリ。なければ先頭のカテゴリ */
export async function defaultCategoryIdForNewProduct(): Promise<Id | null> {
  const products = (await db.products.toArray()).filter((p) => p.deletedAt === null);
  const last = products.reduce<Product | undefined>(
    (a, p) => (!a || p.createdAt >= a.createdAt ? p : a),
    undefined,
  );
  if (last && (await db.categories.get(last.categoryId))) return last.categoryId;
  return (await db.categories.orderBy('sortOrder').first())?.id ?? null;
}

/** カテゴリの中で、1 つ前（-1）か後（+1）と入れ替える */
export async function moveProduct(id: Id, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.products, async () => {
    const target = await db.products.get(id);
    if (!target) return;
    const list = (await db.products.where('categoryId').equals(target.categoryId).toArray())
      .filter((p) => p.deletedAt === null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const i = list.findIndex((p) => p.id === id);
    const a = list[i];
    const b = list[i + direction];
    if (!a || !b) return;
    await db.products.update(a.id, { sortOrder: b.sortOrder });
    await db.products.update(b.id, { sortOrder: a.sortOrder });
  });
}

/**
 * 削除（論理削除）。商品一覧から消え、カートからも外す。
 * 過去の取引には商品名などのコピーがあるので、表示は変わらない。画像は残す。
 */
export async function deleteProduct(id: Id): Promise<void> {
  await db.transaction('rw', db.products, db.kv, async () => {
    const count = await db.products.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
    if (count === 0) throw new AppError('NOT_FOUND', '商品が見つかりません');
    await removeProductFromCart(id);
  });
}

export async function getProductImage(productId: Id): Promise<ProductImage | undefined> {
  return db.productImages.get(productId);
}

export async function setProductImage(image: ProductImage): Promise<void> {
  await db.transaction('rw', db.products, db.productImages, async () => {
    const count = await db.products.update(image.productId, {
      hasImage: true,
      updatedAt: Date.now(),
    });
    if (count === 0) throw new AppError('NOT_FOUND', '商品が見つかりません');
    await db.productImages.put(image);
  });
}

export async function removeProductImage(productId: Id): Promise<void> {
  await db.transaction('rw', db.products, db.productImages, async () => {
    await db.products.update(productId, { hasImage: false, updatedAt: Date.now() });
    await db.productImages.delete(productId);
  });
}

function validate(input: ProductInput): ProductInput {
  return {
    name: validName(input.name, 40, '商品名'),
    price: validNonNegativeInt(input.price, '価格'),
    taxRate: validTaxRate(input.taxRate),
    categoryId: input.categoryId,
    tracksStock: input.tracksStock,
    isOnSale: input.isOnSale,
  };
}

async function assertCategoryExists(categoryId: Id): Promise<void> {
  if (!(await db.categories.get(categoryId))) {
    throw new AppError('INVALID_INPUT', 'カテゴリを選んでください');
  }
}

async function nextSortOrder(categoryId: Id): Promise<number> {
  const list = await db.products.where('categoryId').equals(categoryId).toArray();
  return list.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1;
}
