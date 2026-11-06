import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings } from '../db/kv';
import type { Settings } from '../domain/types';

/** 設定（保存されたら自動で読み直す）。読み込み中は undefined */
export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings);
}
