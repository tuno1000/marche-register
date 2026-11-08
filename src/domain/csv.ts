import { taxRateLabel, type Transaction } from './types';

/**
 * CSV の組み立て（03-データ設計 8 章）
 * 1 行 ＝ 1 明細。UTF-8（BOM 付き）、改行は CRLF。取り消した取引も「状態」列付きで出す。
 */
export const CSV_HEADERS = [
  'イベント名',
  '開催日',
  '取引番号',
  '取引日時',
  '状態',
  '明細番号',
  '商品名',
  'カテゴリ',
  '税率',
  '単価',
  '数量',
  '小計',
  '明細値引き',
  '全体値引き按分',
  '値引き後金額',
] as const;

const BOM = '﻿';
const CRLF = '\r\n';

export function buildCsv(transactions: readonly Transaction[]): string {
  // 開催日 → 取引番号の連番 → 明細番号
  const sorted = [...transactions].sort(
    (a, b) =>
      a.eventDate.localeCompare(b.eventDate) || a.eventId.localeCompare(b.eventId) || a.seq - b.seq,
  );
  const rows: (string | number)[][] = [];
  for (const t of sorted) {
    for (const l of [...t.lines].sort((a, b) => a.lineNo - b.lineNo)) {
      rows.push([
        t.eventName,
        t.eventDate.replaceAll('-', '/'),
        t.receiptNo,
        formatCsvDateTime(t.createdAt),
        t.status === 'valid' ? '有効' : '取消',
        l.lineNo,
        l.productName,
        l.categoryName,
        taxRateLabel(l.taxRate),
        l.unitPrice,
        l.qty,
        l.grossAmount,
        l.lineDiscountAmount,
        l.orderDiscountShare,
        l.netAmount,
      ]);
    }
  }
  return BOM + [CSV_HEADERS, ...rows].map((r) => r.map(csvCell).join(',')).join(CRLF) + CRLF;
}

/**
 * 1 つの値を CSV の形にする。
 * - 先頭が = + - @ の文字列は、Excel で数式として動かないよう先頭に ' を付ける
 * - 「,」「"」、改行を含むときは " で囲み、" は "" にする
 */
export function csvCell(value: string | number): string {
  if (typeof value === 'number') return String(value);
  let s = value;
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replaceAll('"', '""')}"`;
  return s;
}

/** 取引日時：2026/11/03 10:24:05（端末の時刻で） */
export function formatCsvDateTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** ファイル名に使えない文字を「_」にする */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'event';
}

/** 書き出すファイル名（03-データ設計 8 章） */
export function csvFileName(
  target: { eventName: string; eventDate: string } | 'all',
  now: Date = new Date(),
): string {
  if (target === 'all') {
    const p = (n: number) => String(n).padStart(2, '0');
    return `marche-register-all-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.csv`;
  }
  return `marche-register-${safeFileName(target.eventName)}-${target.eventDate.replaceAll('-', '')}.csv`;
}
