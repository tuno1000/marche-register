import { db } from '../db/schema';
import { cartSaved, useCartStore } from '../features/checkout/cartStore';
import { resetViewingEvent } from '../features/events/EventSelect';

/** テストごとにデータベースとメモリのカートを空にする */
export async function resetDb(): Promise<void> {
  await cartSaved();
  useCartStore.setState({ cart: null, loaded: false });
  resetViewingEvent();
  db.close();
  await db.delete();
  await db.open();
}
