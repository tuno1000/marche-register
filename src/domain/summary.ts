import { floorDiv } from './integer';
import type { Id, TaxRate, Transaction, Yen } from './types';
import { TAX_RATES } from './types';

export interface EventSummary {
  salesTotal: Yen;
  transactionCount: number;
  /** 客単価。取引が 0 件なら null */
  averagePerCustomer: Yen | null;
  discountTotal: Yen;
  taxes: { rate: TaxRate; taxableAmount: Yen; taxAmount: Yen }[];
  voidedCount: number;
}

/** イベント別の集計（03-データ設計 4.4）。取り消した取引は含めない */
export function summarizeEvent(transactions: readonly Transaction[]): EventSummary {
  const valid = transactions.filter((t) => t.status === 'valid');
  const salesTotal = sum(valid.map((t) => t.total));
  const count = valid.length;

  const taxes = TAX_RATES.map((rate) => {
    const items = valid.flatMap((t) => t.taxes.filter((x) => x.rate === rate));
    return {
      rate,
      taxableAmount: sum(items.map((x) => x.taxableAmount)),
      // 取引ごとに出した内税の合計（合計額から計算し直さない）
      taxAmount: sum(items.map((x) => x.taxAmount)),
      present: items.length > 0,
    };
  })
    .filter((x) => x.present)
    .map(({ rate, taxableAmount, taxAmount }) => ({ rate, taxableAmount, taxAmount }));

  return {
    salesTotal,
    transactionCount: count,
    // 1 円未満は四捨五入
    averagePerCustomer: count === 0 ? null : floorDiv(salesTotal * 2 + count, count * 2),
    discountTotal: sum(
      valid.map((t) => t.orderDiscountAmount + sum(t.lines.map((l) => l.lineDiscountAmount))),
    ),
    taxes,
    voidedCount: transactions.length - count,
  };
}

export interface ProductSummaryRow {
  productId: Id;
  /** 最新の明細の商品名 */
  productName: string;
  qty: number;
  amount: Yen;
}

export type ProductSortKey = 'qty' | 'amount';

/** 商品別の集計（03-データ設計 4.4）。取り消した取引は含めない */
export function summarizeProducts(
  transactions: readonly Transaction[],
  sortBy: ProductSortKey,
): ProductSummaryRow[] {
  const rows = new Map<Id, ProductSummaryRow & { latestAt: number }>();
  for (const t of transactions) {
    if (t.status !== 'valid') continue;
    for (const line of t.lines) {
      const row = rows.get(line.productId);
      if (!row) {
        rows.set(line.productId, {
          productId: line.productId,
          productName: line.productName,
          qty: line.qty,
          amount: line.netAmount,
          latestAt: t.createdAt,
        });
        continue;
      }
      row.qty += line.qty;
      row.amount += line.netAmount;
      if (t.createdAt >= row.latestAt) {
        row.latestAt = t.createdAt;
        row.productName = line.productName;
      }
    }
  }
  const other: ProductSortKey = sortBy === 'qty' ? 'amount' : 'qty';
  return [...rows.values()]
    .sort(
      (a, b) =>
        b[sortBy] - a[sortBy] ||
        b[other] - a[other] ||
        a.productName.localeCompare(b.productName, 'ja'),
    )
    .map(({ productId, productName, qty, amount }) => ({ productId, productName, qty, amount }));
}

function sum(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0);
}
