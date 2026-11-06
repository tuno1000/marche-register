/**
 * 0 以上の整数どうしの割り算。小数の誤差を出さないよう、整数の計算だけで行う。
 */
export function floorDiv(a: number, b: number): number {
  assertNonNegativeInt(a, 'a');
  assertPositiveInt(b, 'b');
  return (a - (a % b)) / b;
}

export function ceilDiv(a: number, b: number): number {
  return floorDiv(a + b - 1, b);
}

export function assertNonNegativeInt(n: number, name: string): void {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`${name} は 0 以上の整数にしてください: ${n}`);
  }
}

function assertPositiveInt(n: number, name: string): void {
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new RangeError(`${name} は 1 以上の整数にしてください: ${n}`);
  }
}

/**
 * total を weights の比率で分ける（03-データ設計 4.2 の手順 5・6）。
 * 1 円未満は切り捨て、余りは weight の大きい順に 1 円ずつ足す。
 * weight が同じときは priority の小さいほう（配列で先のもの）を優先する。
 */
export function allocate(
  total: number,
  weights: readonly number[],
  priority?: readonly number[],
): number[] {
  assertNonNegativeInt(total, 'total');
  weights.forEach((w, i) => assertNonNegativeInt(w, `weights[${i}]`));
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum === 0) {
    if (total !== 0) throw new RangeError('比率がすべて 0 のときは、分ける額も 0 にしてください');
    return weights.map(() => 0);
  }
  if (total > sum) throw new RangeError(`分ける額（${total}）が比率の合計（${sum}）を超えています`);

  const shares = weights.map((w) => floorDiv(total * w, sum));
  let rest = total - shares.reduce((s, x) => s + x, 0);
  const order = weights
    .map((w, i) => ({ w, i, p: priority?.[i] ?? i }))
    .sort((x, y) => y.w - x.w || x.p - y.p);
  for (const { i } of order) {
    if (rest === 0) break;
    shares[i]! += 1;
    rest -= 1;
  }
  return shares;
}
