import { useLiveQuery } from 'dexie-react-hooks';
import { getProductImage } from '../db/repositories/products';
import type { Id, Product } from '../domain/types';

/**
 * 商品画像の表示用 URL を、商品ごとにメモリに置いて使い回す（04-技術設計 4 章）。
 * 商品が変わった（updatedAt が変わった）ら作り直し、前の URL は解放する。
 */
const cache = new Map<Id, { version: number; url: string }>();

async function loadImageUrl(product: Product): Promise<string | null> {
  const hit = cache.get(product.id);
  if (!product.hasImage) {
    if (hit) {
      URL.revokeObjectURL(hit.url);
      cache.delete(product.id);
    }
    return null;
  }
  if (hit && hit.version === product.updatedAt) return hit.url;
  const image = await getProductImage(product.id);
  if (!image) return null;
  // 読み込みを待つ間に、ほかの呼び出しが作っていたらそれを使う
  const latest = cache.get(product.id);
  if (latest && latest.version === product.updatedAt) return latest.url;
  if (latest) URL.revokeObjectURL(latest.url);
  const url = URL.createObjectURL(new Blob([image.data], { type: image.type }));
  cache.set(product.id, { version: product.updatedAt, url });
  return url;
}

/** 商品画像の URL。画像がないか、読み込み中なら null */
export function useProductImageUrl(product: Product | undefined): string | null {
  return (
    useLiveQuery(
      () => (product ? loadImageUrl(product) : null),
      [product?.id, product?.hasImage, product?.updatedAt],
    ) ?? null
  );
}
