import { cartLineKey, cartLineUnitPrice } from '../../domain/cartLine';
import { calculateCheckout, type CheckoutResult } from '../../domain/checkout';
import type {
  Cart,
  Category,
  Discount,
  Id,
  Product,
  TransactionLine,
  Yen,
} from '../../domain/types';

export interface CartViewLine extends TransactionLine {
  product: Product;
  /** カートの行のキー（cartLineKey） */
  key: string;
  /** 会計のときに入力した単価（価格が空の商品だけ） */
  enteredPrice?: Yen;
}

export interface CartView extends Omit<CheckoutResult, 'lines'> {
  lines: CartViewLine[];
  /** 点数（数量の合計） */
  qty: number;
  orderDiscount: Discount | null;
}

/**
 * カートの金額（値引き・合計）を、今の商品の情報で計算する。
 * 計算は domain の calculateCheckout を使い、画面の中では計算しない（04-技術設計 2 章）。
 * 削除された商品の行と、金額が決まらない行（価格を空にした商品で、単価を入力していない行）は、
 * 確定のときにエラーになるので、ここでは表示から外す。
 */
export function buildCartView(
  cart: Cart | null,
  products: ReadonlyMap<Id, Product>,
  categories: ReadonlyMap<Id, Category>,
): CartView {
  const usable = (cart?.lines ?? []).flatMap((line) => {
    const product = products.get(line.productId);
    if (!product || product.deletedAt !== null || line.qty <= 0) return [];
    const unitPrice = cartLineUnitPrice(line, product);
    return unitPrice === null ? [] : [{ line, product, unitPrice }];
  });
  const result = calculateCheckout(
    usable.map(({ line, product, unitPrice }) => ({
      productId: product.id,
      productName: product.name,
      categoryName: categories.get(product.categoryId)?.name ?? '',
      unitPrice,
      taxRate: product.taxRate,
      qty: line.qty,
      discount: line.discount,
    })),
    cart?.orderDiscount ?? null,
  );
  return {
    ...result,
    lines: result.lines.map((l, i) => {
      const { line, product } = usable[i]!;
      return { ...l, product, key: cartLineKey(line), enteredPrice: line.unitPrice };
    }),
    qty: usable.reduce((s, u) => s + u.line.qty, 0),
    orderDiscount: cart?.orderDiscount ?? null,
  };
}

/**
 * 在庫の残り（カートに入れた分を差し引く）。在庫を管理しない商品は null（02-画面設計 S-01）
 */
export function remainingStock(
  product: Product,
  broughtQty: ReadonlyMap<Id, number>,
  soldQty: ReadonlyMap<Id, number>,
  cart: Cart | null,
): number | null {
  if (!product.tracksStock) return null;
  const inCart =
    cart?.lines.filter((l) => l.productId === product.id).reduce((s, l) => s + l.qty, 0) ?? 0;
  return (broughtQty.get(product.id) ?? 0) - (soldQty.get(product.id) ?? 0) - inCart;
}
