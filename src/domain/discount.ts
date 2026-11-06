import { assertNonNegativeInt, ceilDiv, floorDiv } from './integer';
import type { Discount, Rounding, Yen } from './types';

/**
 * % 値引きの額（03-データ設計 4.1）
 * - floor：値引き額の 1 円未満を切り捨て
 * - ceil：値引き額の 1 円未満を切り上げ
 * - round10：値引き後の金額を 10 円未満切り捨て
 */
export function percentDiscountAmount(base: Yen, percent: number, rounding: Rounding): Yen {
  assertNonNegativeInt(base, 'base');
  assertPercent(percent);
  switch (rounding) {
    case 'floor':
      return floorDiv(base * percent, 100);
    case 'ceil':
      return ceilDiv(base * percent, 100);
    case 'round10':
      return base - floorDiv(base * (100 - percent), 1000) * 10;
  }
}

/** 値引きの額。対象金額を超えない */
export function discountAmount(base: Yen, discount: Discount | null): Yen {
  assertNonNegativeInt(base, 'base');
  if (!discount) return 0;
  if (discount.kind === 'yen') {
    assertNonNegativeInt(discount.value, '値引き額');
    return Math.min(discount.value, base);
  }
  return percentDiscountAmount(base, discount.value, discount.rounding);
}

export function isValidPercent(percent: number): boolean {
  return Number.isInteger(percent) && percent >= 1 && percent <= 100;
}

function assertPercent(percent: number): void {
  if (!isValidPercent(percent)) {
    throw new RangeError(`% は 1〜100 の整数にしてください: ${percent}`);
  }
}
