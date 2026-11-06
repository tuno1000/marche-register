import { calculateCheckout, type CheckoutLineInput } from '../../domain/checkout';
import { AppError } from '../../domain/errors';
import { formatReceiptNo } from '../../domain/receiptNo';
import type { CartLine, Discount, Id, Transaction, Yen } from '../../domain/types';
import { newId } from '../../lib/id';
import { deleteKv, getSettings } from '../kv';
import { db } from '../schema';
import { soldQtyByProduct } from './events';

export interface CheckoutRequest {
  eventId: Id;
  lines: CartLine[];
  orderDiscount: Discount | null;
  tendered: Yen;
}

/**
 * 会計の確定（03-データ設計 5 章）
 * ① 在庫が足りるか確かめる ② 取引番号を決めて nextSeq を増やす ③ 取引を保存 ④ カートを空にする
 * を 1 つのトランザクションで行う。途中で失敗したら、すべて元に戻る。
 */
export async function checkout(req: CheckoutRequest): Promise<Transaction> {
  if (req.lines.length === 0) throw new AppError('EMPTY_CART', 'カートが空です');

  return db.transaction(
    'rw',
    [db.events, db.eventStocks, db.transactions, db.products, db.categories, db.kv],
    async () => {
      const event = await db.events.get(req.eventId);
      if (!event) throw new AppError('NOT_FOUND', 'イベントが見つかりません');

      // 会計時点の商品の情報を読む（スナップショット）
      const inputs: CheckoutLineInput[] = [];
      for (const line of req.lines) {
        const product = await db.products.get(line.productId);
        if (!product || product.deletedAt !== null) {
          throw new AppError('PRODUCT_UNAVAILABLE', 'カートに削除された商品があります');
        }
        const category = await db.categories.get(product.categoryId);
        inputs.push({
          productId: product.id,
          productName: product.name,
          categoryName: category?.name ?? '',
          unitPrice: product.price,
          taxRate: product.taxRate,
          qty: line.qty,
          discount: line.discount,
        });
      }

      // ① 在庫の確認（在庫を管理する商品だけ）
      const sold = await soldQtyByProduct(event.id);
      const wanted = new Map<Id, number>();
      for (const line of req.lines) {
        wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.qty);
      }
      for (const [productId, qty] of wanted) {
        const product = (await db.products.get(productId))!;
        if (!product.tracksStock) continue;
        const stock = await db.eventStocks.get([event.id, productId]);
        const remaining = (stock?.broughtQty ?? 0) - (sold.get(productId) ?? 0);
        if (qty > remaining) {
          throw new AppError(
            'OUT_OF_STOCK',
            `「${product.name}」の在庫が足りません（残り ${remaining}）`,
          );
        }
      }

      const calc = calculateCheckout(inputs, req.orderDiscount);
      if (!Number.isSafeInteger(req.tendered) || req.tendered < calc.total) {
        throw new AppError('INSUFFICIENT_TENDER', 'お預かりが合計に足りません');
      }

      // ② 取引番号。取り消しても戻さないので、欠番は使い回さない
      const seq = event.nextSeq;
      await db.events.update(event.id, { nextSeq: seq + 1 });

      // ③ 取引を保存
      const settings = await getSettings();
      const tx: Transaction = {
        id: newId(),
        eventId: event.id,
        seq,
        receiptNo: formatReceiptNo(event.date, seq),
        createdAt: Date.now(),
        status: 'valid',
        voidedAt: null,
        eventName: event.name,
        eventDate: event.date,
        receipt: {
          shopName: settings.shopName,
          invoiceNo: settings.invoiceNo,
          contact: settings.contact,
          links: settings.links.map((l) => ({ ...l })),
          footer: settings.footer,
        },
        lines: calc.lines,
        orderDiscount: req.orderDiscount,
        subtotal: calc.subtotal,
        orderDiscountAmount: calc.orderDiscountAmount,
        total: calc.total,
        taxes: calc.taxes,
        tendered: req.tendered,
        change: req.tendered - calc.total,
      };
      await db.transactions.add(tx);

      // ④ カートを空にする
      await deleteKv('cart');
      return tx;
    },
  );
}

/**
 * 取引の取消。在庫は取引から計算しているので、印を付けるだけで戻る。
 * 取り消した取引を元に戻すことはできない（要件定義 F-07）。
 */
export async function voidTransaction(id: Id): Promise<void> {
  await db.transaction('rw', db.transactions, async () => {
    const tx = await db.transactions.get(id);
    if (!tx) throw new AppError('NOT_FOUND', '取引が見つかりません');
    if (tx.status === 'voided') throw new AppError('ALREADY_VOIDED', 'この取引は取り消し済みです');
    await db.transactions.update(id, { status: 'voided', voidedAt: Date.now() });
  });
}

/** そのイベントの取引（新しい順） */
export async function listTransactions(eventId: Id): Promise<Transaction[]> {
  const list = await db.transactions
    .where('[eventId+seq]')
    .between([eventId, -Infinity], [eventId, Infinity])
    .toArray();
  return list.reverse();
}

export async function getTransaction(id: Id): Promise<Transaction | undefined> {
  return db.transactions.get(id);
}
