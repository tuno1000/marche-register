import type { CartLine, Id, Product, Yen } from './types';

/** カートの行を見分けるキー。価格が空の商品は、入力した単価ごとに別の行にする */
export function cartLineKey(line: { productId: Id; unitPrice?: Yen }): string {
  return line.unitPrice === undefined ? line.productId : `${line.productId}@${line.unitPrice}`;
}

/**
 * カートの行の単価。会計のときに入力した単価があればそれを、なければ商品の価格を使う。
 * どちらもない（価格が空の商品なのに単価がない）ときは null
 */
export function cartLineUnitPrice(line: CartLine, product: Product): Yen | null {
  return line.unitPrice ?? product.price;
}
