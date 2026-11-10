import { z } from 'zod';
import type {
  Category,
  EventStock,
  Id,
  MarketEvent,
  Product,
  ProductImage,
  Settings,
  Transaction,
} from './types';
import { CATEGORY_COLORS } from './types';

/**
 * JSON バックアップの形式と検査（03-データ設計 7 章）
 */
export const BACKUP_FORMAT = 'marche-register-backup';
/** 今のアプリが書き出す形式の版。形を変えたら上げて、migrate に古い版からの変換を足す */
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupData {
  categories: Category[];
  products: Product[];
  productImages: BackupImage[];
  events: MarketEvent[];
  eventStocks: EventStock[];
  transactions: Transaction[];
  settings: Settings;
  currentEventId: Id | null;
}

/** 画像は JSON にできるよう Base64 にする */
export interface BackupImage {
  productId: Id;
  mime: string;
  width: number;
  height: number;
  base64: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  appVersion: string;
  /** 例：2026-11-03T18:20:00+09:00 */
  exportedAt: string;
  counts: { categories: number; products: number; events: number; transactions: number };
  data: BackupData;
}

export function buildBackup(
  data: BackupData,
  appVersion: string,
  now: Date = new Date(),
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion,
    exportedAt: localIsoString(now),
    counts: {
      categories: data.categories.length,
      // 削除した商品は数えない（画面の「商品数」と合わせる）
      products: data.products.filter((p) => p.deletedAt === null).length,
      events: data.events.length,
      transactions: data.transactions.length,
    },
    data,
  };
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `marche-register-backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

/** 端末の時差つきの ISO 形式：2026-11-03T18:20:00+09:00 */
export function localIsoString(d: Date): string {
  const p = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${sign}${p(Math.trunc(offset / 60))}:${p(offset % 60)}`
  );
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; message: string };

export const MESSAGES = {
  notBackup: 'このアプリのバックアップファイルではありません',
  tooNew: 'アプリを最新にしてから復元してください',
} as const;

/** ファイルの中身を検査する。古い版なら今の形式へ変換する */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: MESSAGES.notBackup };
  }
  const head = z
    .object({ format: z.literal(BACKUP_FORMAT), formatVersion: z.number().int().min(1) })
    .safeParse(raw);
  if (!head.success) return { ok: false, message: MESSAGES.notBackup };
  if (head.data.formatVersion > BACKUP_FORMAT_VERSION)
    return { ok: false, message: MESSAGES.tooNew };

  const migrated = migrate(raw as Record<string, unknown>, head.data.formatVersion);
  const parsed = backupSchema.safeParse(migrated);
  if (!parsed.success) return { ok: false, message: MESSAGES.notBackup };
  return { ok: true, backup: parsed.data as BackupFile };
}

/** 古い版のファイルを、今の版の形にする（版を上げたら、ここに変換を足す） */
function migrate(raw: Record<string, unknown>, version: number): unknown {
  // 版 1 が最初の版なので、まだ変換はない
  void version;
  return raw;
}

/** Base64 ⇔ ArrayBuffer */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function toBackupImage(image: ProductImage): BackupImage {
  return {
    productId: image.productId,
    mime: image.type,
    width: image.width,
    height: image.height,
    base64: arrayBufferToBase64(image.data),
  };
}

export function fromBackupImage(image: BackupImage): ProductImage {
  return {
    productId: image.productId,
    type: image.mime,
    width: image.width,
    height: image.height,
    data: base64ToArrayBuffer(image.base64),
  };
}

// ---- 形の検査（03-データ設計 3 章の型） ----

const int = z.number().int();
const nonNegInt = int.min(0);
const yen = nonNegInt;
const taxRate = z.union([z.literal(0), z.literal(1), z.literal(8), z.literal(10)]);
const rounding = z.enum(['floor', 'ceil', 'round10']);
const discount = z.union([
  z.object({ kind: z.literal('yen'), value: yen }),
  z.object({ kind: z.literal('percent'), value: int.min(1).max(100), rounding }),
]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const link = z.object({ label: z.string(), url: z.string() });

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.enum(CATEGORY_COLORS as unknown as [string, ...string[]]),
  sortOrder: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: yen.nullable(),
  taxRate,
  categoryId: z.string(),
  hasImage: z.boolean(),
  tracksStock: z.boolean(),
  isOnSale: z.boolean(),
  deletedAt: z.number().nullable(),
  sortOrder: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const imageSchema = z.object({
  productId: z.string(),
  mime: z.string(),
  width: nonNegInt,
  height: nonNegInt,
  base64: z.string(),
});

const eventSchema = z.object({
  id: z.string(),
  name: z.string(),
  date,
  location: z.string(),
  memo: z.string(),
  nextSeq: int.min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const stockSchema = z.object({
  eventId: z.string(),
  productId: z.string(),
  broughtQty: nonNegInt,
  updatedAt: z.number(),
});

const lineSchema = z.object({
  lineNo: int.min(1),
  productId: z.string(),
  productName: z.string(),
  categoryName: z.string(),
  unitPrice: yen,
  taxRate,
  qty: int.min(1),
  grossAmount: yen,
  lineDiscount: discount.nullable(),
  lineDiscountAmount: yen,
  orderDiscountShare: yen,
  netAmount: yen,
});

const transactionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  seq: int.min(1),
  receiptNo: z.string(),
  createdAt: z.number(),
  status: z.enum(['valid', 'voided']),
  voidedAt: z.number().nullable(),
  eventName: z.string(),
  eventDate: date,
  receipt: z.object({
    shopName: z.string(),
    invoiceNo: z.string(),
    contact: z.string(),
    links: z.array(link),
    footer: z.string(),
  }),
  lines: z.array(lineSchema),
  orderDiscount: discount.nullable(),
  subtotal: yen,
  orderDiscountAmount: yen,
  total: yen,
  taxes: z.array(z.object({ rate: taxRate, taxableAmount: yen, taxAmount: yen })),
  tendered: yen,
  change: yen,
});

const settingsSchema = z.object({
  shopName: z.string(),
  invoiceNo: z.string(),
  contact: z.string(),
  links: z.array(link).max(3),
  footer: z.string(),
  defaultRounding: rounding,
  theme: z.enum(['light', 'dark']),
  discountPresets: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.enum(['yen', 'percent']),
        value: z.number(),
        scope: z.enum(['line', 'order', 'both']),
      }),
    )
    .max(8),
});

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: int,
  appVersion: z.string(),
  exportedAt: z.string(),
  counts: z.object({
    categories: nonNegInt,
    products: nonNegInt,
    events: nonNegInt,
    transactions: nonNegInt,
  }),
  data: z.object({
    categories: z.array(categorySchema),
    products: z.array(productSchema),
    productImages: z.array(imageSchema),
    events: z.array(eventSchema),
    eventStocks: z.array(stockSchema),
    transactions: z.array(transactionSchema),
    settings: settingsSchema,
    currentEventId: z.string().nullable(),
  }),
});
