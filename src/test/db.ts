import { db } from '../db/schema';

/** テストごとにデータベースを空にする */
export async function resetDb(): Promise<void> {
  db.close();
  await db.delete();
  await db.open();
}
