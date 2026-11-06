import { Dexie, type EntityTable, type Table } from 'dexie';
import type {
  Category,
  EventStock,
  MarketEvent,
  Product,
  ProductImage,
  Transaction,
} from '../domain/types';

export interface KvRow {
  key: string;
  value: unknown;
}

/**
 * データベース名：本番は 'marche-register'、開発用サーバーでは 'marche-register-dev'
 * （04-技術設計 10.3）
 */
export const DB_NAME = import.meta.env.DEV ? 'marche-register-dev' : 'marche-register';

export class MarcheDb extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  products!: EntityTable<Product, 'id'>;
  productImages!: EntityTable<ProductImage, 'productId'>;
  events!: EntityTable<MarketEvent, 'id'>;
  eventStocks!: Table<EventStock, [string, string]>;
  transactions!: EntityTable<Transaction, 'id'>;
  kv!: EntityTable<KvRow, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    // バージョン 1（03-データ設計 2 章）。変えるときはバージョンを上げる（6 章）
    this.version(1).stores({
      categories: 'id, sortOrder',
      products: 'id, categoryId, sortOrder',
      productImages: 'productId',
      events: 'id, date',
      eventStocks: '[eventId+productId], eventId',
      transactions: 'id, eventId, [eventId+seq], createdAt',
      kv: 'key',
    });
  }
}

export const db = new MarcheDb();
