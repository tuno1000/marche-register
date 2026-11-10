/**
 * データの型（03-データ設計 3 章）
 * domain は他のどこにも依存しないので、型もここに置き、db からも使う。
 */

export type Id = string;
/** 円単位の整数 */
export type Yen = number;
/** Date.now() の値 */
export type EpochMs = number;
/** 'YYYY-MM-DD' */
export type DateString = string;
/**
 * 税率。0 は「税込み」：税率を決めずに扱い、内消費税を計算しない
 * （レシートの税率別の欄と集計の税率別の表には出さない）
 */
export type TaxRate = 0 | 1 | 8 | 10;
/** 切り捨て / 切り上げ / 10 円単位 */
export type Rounding = 'floor' | 'ceil' | 'round10';
export type CategoryColor =
  'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8' | 'c9' | 'c10' | 'c11' | 'c12';

/** 「税込み」（内消費税を計算しない） */
export const TAX_INCLUDED = 0;
/** 選ぶときの並び順 */
export const TAX_RATES: readonly TaxRate[] = [1, 8, 10, TAX_INCLUDED];

/** 税率の表示：'8%'、「税込み」 */
export function taxRateLabel(rate: TaxRate): string {
  return rate === TAX_INCLUDED ? '税込み' : `${rate}%`;
}
export const CATEGORY_COLORS: readonly CategoryColor[] = [
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'c6',
  'c7',
  'c8',
  'c9',
  'c10',
  'c11',
  'c12',
];

export interface Category {
  id: Id;
  name: string;
  color: CategoryColor;
  sortOrder: number;
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface Product {
  id: Id;
  name: string;
  /** 税込。0 以上。null は「会計のときに金額を入力する」 */
  price: Yen | null;
  taxRate: TaxRate;
  categoryId: Id;
  /** productImages にあるか */
  hasImage: boolean;
  /** 在庫を管理する */
  tracksStock: boolean;
  /** 販売中（OFF なら会計画面に出さない） */
  isOnSale: boolean;
  /** 削除（論理削除）した日時。null 以外なら商品一覧にも出さない */
  deletedAt: EpochMs | null;
  /** カテゴリ内の並び順 */
  sortOrder: number;
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface ProductImage {
  productId: Id;
  /**
   * 画像のデータ（JPEG）。Blob ではなく ArrayBuffer で持つ。
   * iPhone などの WebKit では、プライベートブラウズなどで Blob を保存できないことがあるため
   */
  data: ArrayBuffer;
  /** 'image/jpeg' */
  type: string;
  width: number;
  height: number;
}

export interface MarketEvent {
  id: Id;
  name: string;
  /** 開催日 */
  date: DateString;
  location: string;
  memo: string;
  /** 次に使う取引の連番（1 から） */
  nextSeq: number;
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface EventStock {
  eventId: Id;
  productId: Id;
  /** 持ち込み数 */
  broughtQty: number;
  updatedAt: EpochMs;
}

export type Discount =
  { kind: 'yen'; value: Yen } | { kind: 'percent'; value: number; rounding: Rounding };

export interface TaxSummary {
  rate: TaxRate;
  /** 税率別の税込合計（値引き後） */
  taxableAmount: Yen;
  /** 内消費税 */
  taxAmount: Yen;
}

export interface ReceiptSnapshot {
  shopName: string;
  invoiceNo: string;
  contact: string;
  links: ReceiptLink[];
  footer: string;
}

export interface ReceiptLink {
  label: string;
  url: string;
}

export interface TransactionLine {
  lineNo: number;
  productId: Id;
  productName: string;
  categoryName: string;
  unitPrice: Yen;
  taxRate: TaxRate;
  qty: number;
  /** 単価 × 数量 */
  grossAmount: Yen;
  lineDiscount: Discount | null;
  lineDiscountAmount: Yen;
  /** 全体値引きの按分額 */
  orderDiscountShare: Yen;
  /** grossAmount − lineDiscountAmount − orderDiscountShare */
  netAmount: Yen;
}

export interface Transaction {
  id: Id;
  eventId: Id;
  seq: number;
  /** 'MMDD-NNN' */
  receiptNo: string;
  createdAt: EpochMs;
  status: 'valid' | 'voided';
  voidedAt: EpochMs | null;
  eventName: string;
  eventDate: DateString;
  receipt: ReceiptSnapshot;
  lines: TransactionLine[];
  orderDiscount: Discount | null;
  /** 明細値引き後の合計（全体値引きの前） */
  subtotal: Yen;
  orderDiscountAmount: Yen;
  total: Yen;
  taxes: TaxSummary[];
  tendered: Yen;
  change: Yen;
}

export interface DiscountPreset {
  id: Id;
  label: string;
  kind: 'yen' | 'percent';
  value: number;
  /** 商品ごと / 会計全体 / 両方 */
  scope: 'line' | 'order' | 'both';
}

export interface Settings {
  shopName: string;
  /** '' または 'T' + 13 桁 */
  invoiceNo: string;
  contact: string;
  /** 最大 3 件 */
  links: ReceiptLink[];
  footer: string;
  defaultRounding: Rounding;
  theme: 'light' | 'dark';
  /** 最大 8 件。配列の順がボタンの順 */
  discountPresets: DiscountPreset[];
}

export interface CartLine {
  productId: Id;
  /**
   * 会計のときに入力した単価（価格が空の商品だけ）。
   * 同じ商品でも単価が違えば別の行にする
   */
  unitPrice?: Yen;
  qty: number;
  discount: Discount | null;
}

export interface Cart {
  eventId: Id;
  lines: CartLine[];
  orderDiscount: Discount | null;
  updatedAt: EpochMs;
}
