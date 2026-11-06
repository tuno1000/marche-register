import { db } from '../db/schema';
import { cartSaved, useCartStore } from '../features/checkout/cartStore';

/** テストごとにデータベースとメモリのカートを空にする */
export async function resetDb(): Promise<void> {
  await cartSaved();
  useCartStore.setState({ cart: null, loaded: false });
  db.close();
  await db.delete();
  await db.open();
}
