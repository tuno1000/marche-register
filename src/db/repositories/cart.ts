import type { Cart, Id } from '../../domain/types';
import { deleteKv, getKv, setKv } from '../kv';
import { db } from '../schema';

/** 会計中のカート（03-データ設計 3.8）。アプリを閉じても残すために保存する */
export async function getCart(): Promise<Cart | null> {
  return (await getKv('cart')) ?? null;
}

export async function saveCart(cart: Cart): Promise<void> {
  await setKv('cart', cart);
}

export async function clearCart(): Promise<void> {
  await deleteKv('cart');
}

/** カートからその商品を外す（商品を削除したとき） */
export async function removeProductFromCart(productId: Id): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const cart = await getCart();
    if (!cart || !cart.lines.some((l) => l.productId === productId)) return;
    await saveCart({
      ...cart,
      lines: cart.lines.filter((l) => l.productId !== productId),
      updatedAt: Date.now(),
    });
  });
}
