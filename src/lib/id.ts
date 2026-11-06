import type { Id } from '../domain/types';

/** UUID を作る（03-データ設計 1 章） */
export function newId(): Id {
  return crypto.randomUUID();
}
