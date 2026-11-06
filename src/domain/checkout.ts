import { discountAmount } from './discount';
import { allocate, assertNonNegativeInt, floorDiv } from './integer';
import type { Discount, Id, TaxRate, TaxSummary, TransactionLine, Yen } from './types';
import { TAX_RATES } from './types';

/** 計算に使う明細（会計時点の商品の情報） */
export interface CheckoutLineInput {
  productId: Id;
  productName: string;
  categoryName: string;
  unitPrice: Yen;
  taxRate: TaxRate;
  qty: number;
  discount: Discount | null;
}

export interface CheckoutResult {
  lines: TransactionLine[];
  subtotal: Yen;
  orderDiscountAmount: Yen;
  total: Yen;
  taxes: TaxSummary[];
}

/**
 * 1 取引の計算（03-データ設計 4.2）
 */
export function calculateCheckout(
  inputs: readonly CheckoutLineInput[],
  orderDiscount: Discount | null,
): CheckoutResult {
  // 手順 1・2：明細ごとの金額と、明細値引き
  const lines = inputs.map((input, i) => {
    assertNonNegativeInt(input.unitPrice, '単価');
    if (!Number.isSafeInteger(input.qty) || input.qty < 1) {
      throw new RangeError(`数量は 1 以上の整数にしてください: ${input.qty}`);
    }
    const grossAmount = input.unitPrice * input.qty;
    const lineDiscountAmount = discountAmount(grossAmount, input.discount);
    return {
      lineNo: i + 1,
      input,
      grossAmount,
      lineDiscountAmount,
      afterLine: grossAmount - lineDiscountAmount,
    };
  });

  // 手順 3・4：小計と全体値引き
  const subtotal = sum(lines.map((l) => l.afterLine));
  const orderDiscountAmount = discountAmount(subtotal, orderDiscount);

  // 手順 5：税率ごとに按分する（合計が同じなら 10% を優先）
  const rates = TAX_RATES.filter((rate) => lines.some((l) => l.input.taxRate === rate));
  const rateTotals = rates.map((rate) =>
    sum(lines.filter((l) => l.input.taxRate === rate).map((l) => l.afterLine)),
  );
  const ratePriority = rates.map((rate) => -rate);
  const rateShares = allocate(orderDiscountAmount, rateTotals, ratePriority);

  // 手順 6：税率の中で明細ごとに按分する（金額が同じなら行番号の小さい明細を優先）
  const shareByLineNo = new Map<number, Yen>();
  rates.forEach((rate, r) => {
    const group = lines.filter((l) => l.input.taxRate === rate);
    const shares = allocate(
      rateShares[r]!,
      group.map((l) => l.afterLine),
      group.map((l) => l.lineNo),
    );
    group.forEach((l, i) => shareByLineNo.set(l.lineNo, shares[i]!));
  });

  // 手順 7
  const resultLines: TransactionLine[] = lines.map((l) => {
    const orderDiscountShare = shareByLineNo.get(l.lineNo) ?? 0;
    return {
      lineNo: l.lineNo,
      productId: l.input.productId,
      productName: l.input.productName,
      categoryName: l.input.categoryName,
      unitPrice: l.input.unitPrice,
      taxRate: l.input.taxRate,
      qty: l.input.qty,
      grossAmount: l.grossAmount,
      lineDiscount: l.input.discount,
      lineDiscountAmount: l.lineDiscountAmount,
      orderDiscountShare,
      netAmount: l.afterLine - orderDiscountShare,
    };
  });

  // 手順 8：税率ごとの内消費税（1 取引・1 税率ごとに 1 回だけ切り捨て）
  const taxes: TaxSummary[] = rates.map((rate) => {
    const taxableAmount = sum(
      resultLines.filter((l) => l.taxRate === rate).map((l) => l.netAmount),
    );
    return { rate, taxableAmount, taxAmount: includedTax(taxableAmount, rate) };
  });

  // 手順 9
  return {
    lines: resultLines,
    subtotal,
    orderDiscountAmount,
    total: subtotal - orderDiscountAmount,
    taxes,
  };
}

/** 内消費税 = floor(税込額 × 税率 ÷ (100 + 税率)) */
export function includedTax(amount: Yen, rate: TaxRate): Yen {
  return floorDiv(amount * rate, 100 + rate);
}

function sum(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0);
}
