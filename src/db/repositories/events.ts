import { AppError } from '../../domain/errors';
import type { EventStock, Id, MarketEvent } from '../../domain/types';
import { newId } from '../../lib/id';
import { getKv, setKv, deleteKv } from '../kv';
import { db } from '../schema';
import { validDate, validName, validNonNegativeInt } from '../validate';

export interface EventInput {
  name: string;
  date: string;
  location: string;
  memo: string;
}

/** 開催日の新しい順 */
export async function listEvents(): Promise<MarketEvent[]> {
  const list = await db.events.toArray();
  return list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export async function getEvent(id: Id): Promise<MarketEvent | undefined> {
  return db.events.get(id);
}

export async function createEvent(input: EventInput): Promise<MarketEvent> {
  const now = Date.now();
  const event: MarketEvent = {
    id: newId(),
    ...validate(input),
    nextSeq: 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.events.add(event);
  return event;
}

export async function updateEvent(id: Id, input: Partial<EventInput>): Promise<void> {
  await db.transaction('rw', db.events, async () => {
    const current = await db.events.get(id);
    if (!current) throw new AppError('NOT_FOUND', 'イベントが見つかりません');
    await db.events.update(id, { ...validate({ ...current, ...input }), updatedAt: Date.now() });
  });
}

/** 取引があるか（取り消した取引を含む） */
export async function hasTransactions(eventId: Id): Promise<boolean> {
  return (await db.transactions.where('eventId').equals(eventId).count()) > 0;
}

/**
 * 会計したことのないイベントだけ削除できる（03-データ設計 DD-3）。
 * 持ち込み在庫も消し、現在のイベントだったら未選択にする。
 */
export async function deleteEvent(id: Id): Promise<void> {
  await db.transaction('rw', db.events, db.eventStocks, db.transactions, db.kv, async () => {
    if (await hasTransactions(id)) {
      throw new AppError('EVENT_HAS_TRANSACTIONS', '会計したことのあるイベントは削除できません');
    }
    await db.events.delete(id);
    await db.eventStocks.where('eventId').equals(id).delete();
    if ((await getKv('currentEventId')) === id) await setKv('currentEventId', null);
    if ((await getKv('cart'))?.eventId === id) await deleteKv('cart');
  });
}

/** そのイベントの持ち込み在庫 */
export async function listEventStocks(eventId: Id): Promise<EventStock[]> {
  return db.eventStocks.where('eventId').equals(eventId).toArray();
}

/**
 * 商品ごとの販売数（有効な取引の明細の数量の合計）。03-データ設計 3.6
 */
export async function soldQtyByProduct(eventId: Id): Promise<Map<Id, number>> {
  const sold = new Map<Id, number>();
  await db.transactions
    .where('eventId')
    .equals(eventId)
    .each((t) => {
      if (t.status !== 'valid') return;
      for (const line of t.lines) {
        sold.set(line.productId, (sold.get(line.productId) ?? 0) + line.qty);
      }
    });
  return sold;
}

/** 持ち込み数を変える。販売数より少なくはできない（02-画面設計 S-06a） */
export async function setBroughtQty(eventId: Id, productId: Id, qty: number): Promise<void> {
  validNonNegativeInt(qty, '持ち込み数');
  await db.transaction('rw', db.events, db.eventStocks, db.transactions, async () => {
    if (!(await db.events.get(eventId))) {
      throw new AppError('NOT_FOUND', 'イベントが見つかりません');
    }
    const sold = (await soldQtyByProduct(eventId)).get(productId) ?? 0;
    if (qty < sold) {
      throw new AppError('BELOW_SOLD_QTY', `持ち込み数は販売数（${sold}）より少なくできません`);
    }
    await db.eventStocks.put({ eventId, productId, broughtQty: qty, updatedAt: Date.now() });
  });
}

function validate(input: EventInput): EventInput {
  return {
    name: validName(input.name, 40, 'イベント名'),
    date: validDate(input.date),
    location: input.location.trim(),
    memo: input.memo.trim(),
  };
}
