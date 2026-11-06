import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell, csvFileName, CSV_HEADERS } from './csv';
import type { Transaction, TransactionLine } from './types';

function line(over: Partial<TransactionLine> = {}): TransactionLine {
  return {
    lineNo: 1,
    productId: 'p1',
    productName: 'クッキー',
    categoryName: '焼き菓子',
    unitPrice: 300,
    taxRate: 8,
    qty: 2,
    grossAmount: 600,
    lineDiscount: { kind: 'percent', value: 10, rounding: 'floor' },
    lineDiscountAmount: 60,
    orderDiscountShare: 55,
    netAmount: 485,
    ...over,
  };
}

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    eventId: 'e1',
    seq: 12,
    receiptNo: '1103-012',
    createdAt: new Date(2026, 10, 3, 10, 24, 5).getTime(),
    status: 'valid',
    voidedAt: null,
    eventName: '○○マルシェ',
    eventDate: '2026-11-03',
    receipt: { shopName: '', invoiceNo: '', contact: '', links: [], footer: '' },
    lines: [line()],
    orderDiscount: null,
    subtotal: 0,
    orderDiscountAmount: 0,
    total: 0,
    taxes: [],
    tendered: 0,
    change: 0,
    ...over,
  };
}

describe('CSV', () => {
  it('BOM 付き、CRLF、15 列の順番、明細 1 行（03 の 8 章の例）', () => {
    const csv = buildCsv([tx()]);
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = csv.slice(1).split('\r\n');
    expect(rows).toHaveLength(3); // 見出し、明細、最後の空行
    expect(rows[0]).toBe(CSV_HEADERS.join(','));
    expect(rows[0]!.split(',')).toHaveLength(15);
    expect(rows[1]).toBe(
      '○○マルシェ,2026/11/03,1103-012,2026/11/03 10:24:05,有効,1,クッキー,焼き菓子,8%,300,2,600,60,55,485',
    );
    expect(rows[2]).toBe('');
  });

  it('取り消した取引も「取消」で出す', () => {
    const csv = buildCsv([tx({ status: 'voided', voidedAt: 1 })]);
    expect(csv.split('\r\n')[1]).toContain(',取消,');
  });

  it('並び順：開催日 → 連番 → 明細番号', () => {
    const csv = buildCsv([
      tx({
        id: 'a',
        seq: 2,
        receiptNo: '1103-002',
        lines: [line({ lineNo: 2, productName: 'B' }), line({ productName: 'A' })],
      }),
      tx({ id: 'b', seq: 1, receiptNo: '1103-001' }),
      tx({ id: 'c', eventId: 'e0', eventDate: '2026-10-01', seq: 5, receiptNo: '1001-005' }),
    ]);
    const cols = csv
      .slice(1)
      .split('\r\n')
      .slice(1, -1)
      .map((r) => r.split(','));
    expect(cols.map((c) => `${c[2]}#${c[5]}`)).toEqual([
      '1001-005#1',
      '1103-001#1',
      '1103-002#1',
      '1103-002#2',
    ]);
  });

  it('「,」「"」・改行を含む値は " で囲む', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('5"の皿')).toBe('"5""の皿"');
    expect(csvCell('1行目\n2行目')).toBe('"1行目\n2行目"');
    expect(csvCell('普通')).toBe('普通');
  });

  it("先頭が = + - @ の文字列には ' を付ける（数式として動かないように）", () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@a')).toBe("'@a");
    expect(csvCell('=a,b')).toBe(`"'=a,b"`);
    // 数値はそのまま
    expect(csvCell(-5)).toBe('-5');
  });

  it('ファイル名：イベント名と開催日。全イベントは書き出した日', () => {
    expect(csvFileName({ eventName: '○○マルシェ', eventDate: '2026-11-03' })).toBe(
      'marche-register-○○マルシェ-20261103.csv',
    );
    expect(csvFileName({ eventName: 'a/b c', eventDate: '2026-11-03' })).toBe(
      'marche-register-a_b_c-20261103.csv',
    );
    expect(csvFileName('all', new Date(2026, 0, 5))).toBe('marche-register-all-20260105.csv');
  });
});
