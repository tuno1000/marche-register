import type { Cart, EpochMs, Id, Settings } from '../domain/types';
import { db } from './schema';
import { defaultSettings } from './defaults';

/** kv ストアのキーと値の型（03-データ設計 3.8） */
export interface KvValues {
  settings: Settings;
  currentEventId: Id | null;
  cart: Cart;
  lastBackupAt: EpochMs | null;
  installWarningDismissed: boolean;
}

export type KvKey = keyof KvValues;

export async function getKv<K extends KvKey>(key: K): Promise<KvValues[K] | undefined> {
  const row = await db.kv.get(key);
  return row?.value as KvValues[K] | undefined;
}

export async function setKv<K extends KvKey>(key: K, value: KvValues[K]): Promise<void> {
  await db.kv.put({ key, value });
}

export async function deleteKv(key: KvKey): Promise<void> {
  await db.kv.delete(key);
}

/** 設定。保存されていない項目は初期値で補う（03-データ設計 6 章） */
export async function getSettings(): Promise<Settings> {
  const saved = await getKv('settings');
  return { ...defaultSettings(), ...saved };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.kv, async () => {
    const next = { ...(await getSettings()), ...patch };
    await setKv('settings', next);
    return next;
  });
}

export async function getCurrentEventId(): Promise<Id | null> {
  return (await getKv('currentEventId')) ?? null;
}

export async function setCurrentEventId(id: Id | null): Promise<void> {
  await setKv('currentEventId', id);
}
