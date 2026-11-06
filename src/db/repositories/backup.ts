import { buildBackup, fromBackupImage, toBackupImage, type BackupFile } from '../../domain/backup';
import { defaultSettings } from '../defaults';
import { getKv, getSettings, setKv } from '../kv';
import { db } from '../schema';

const ALL_STORES = () => [
  db.categories,
  db.products,
  db.productImages,
  db.events,
  db.eventStocks,
  db.transactions,
  db.kv,
];

/** 全データをバックアップの形にする（03-データ設計 7 章）。カートなどは含めない */
export async function createBackup(
  appVersion: string,
  now: Date = new Date(),
): Promise<BackupFile> {
  return db.transaction('r', ALL_STORES(), async () => {
    const [categories, products, images, events, eventStocks, transactions] = await Promise.all([
      db.categories.toArray(),
      db.products.toArray(),
      db.productImages.toArray(),
      db.events.toArray(),
      db.eventStocks.toArray(),
      db.transactions.toArray(),
    ]);
    return buildBackup(
      {
        categories,
        products,
        productImages: images.map(toBackupImage),
        events,
        eventStocks,
        transactions,
        settings: await getSettings(),
        currentEventId: (await getKv('currentEventId')) ?? null,
      },
      appVersion,
      now,
    );
  });
}

/** 書き出したら前回のバックアップの日時を残す */
export async function markBackedUp(at: number = Date.now()): Promise<void> {
  await setKv('lastBackupAt', at);
}

/**
 * 復元：1 つのトランザクションで「全ストアを空にする → 書き込む」。
 * 途中で失敗したら、元のデータのまま残る。
 * カートは空にする。インストール案内の状態と前回のバックアップ日時は、この端末のものを残す。
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  const { data } = backup;
  await db.transaction('rw', ALL_STORES(), async () => {
    const keep = await db.kv.bulkGet(['installWarningDismissed', 'lastBackupAt']);
    await Promise.all(ALL_STORES().map((t) => t.clear()));
    // bulkAdd なので、ID が重なっていたら失敗して元に戻る
    await db.categories.bulkAdd(data.categories);
    await db.products.bulkAdd(data.products);
    await db.productImages.bulkAdd(data.productImages.map(fromBackupImage));
    await db.events.bulkAdd(data.events);
    await db.eventStocks.bulkAdd(data.eventStocks);
    await db.transactions.bulkAdd(data.transactions);
    await setKv('settings', { ...defaultSettings(), ...data.settings });
    await setKv('currentEventId', data.currentEventId);
    for (const row of keep) if (row) await db.kv.put(row);
  });
}

/**
 * 全データの削除（03-データ設計 5 章）：すべてのストアを空にし、設定を初期値に戻す。
 * インストール案内で「このまま使う」を選んだことだけは残す（端末の状態のため）
 */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', ALL_STORES(), async () => {
    const dismissed = await db.kv.get('installWarningDismissed');
    await Promise.all(ALL_STORES().map((t) => t.clear()));
    if (dismissed) await db.kv.put(dismissed);
  });
}
