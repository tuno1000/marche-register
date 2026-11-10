import { create } from 'zustand';
import { clearCart as clearSavedCart, getCart, saveCart } from '../../db/repositories/cart';
import { cartLineKey } from '../../domain/cartLine';
import type { Cart, CartLine, Discount, Id, Yen } from '../../domain/types';

/**
 * 会計中のカート（04-技術設計 4 章）
 * タップしたらまずメモリのカートを変えてすぐ画面に反映し、同時に kv.cart へ書き込む（完了は待たない）。
 * 起動したときと会計画面を開いたときに kv.cart から読み戻す。
 */
interface CartState {
  /** 保存されたカートを読み終えたか */
  loaded: boolean;
  cart: Cart | null;
  /** 保存されたカートを読み戻す */
  hydrate: () => Promise<void>;
  /**
   * 1 個追加する。別のイベントのカートが残っていたら、捨てて新しく始める。
   * unitPrice は、価格が空の商品で会計のときに入力した単価（同じ商品・同じ単価の行があれば数量を増やす）
   */
  add: (eventId: Id, productId: Id, unitPrice?: Yen) => void;
  /** 数量を変える。0 以下なら行を消す。key は cartLineKey */
  setQty: (key: string, qty: number) => void;
  /**
   * 行の単価を変える。undefined なら入力した単価を外す（登録した価格に戻す）。
   * 変えた結果、同じ商品・同じ単価の行があれば、その行に数量をまとめる（値引きはまとめ先のものを残す）
   */
  setUnitPrice: (key: string, unitPrice: Yen | undefined) => void;
  removeLine: (key: string) => void;
  setLineDiscount: (key: string, discount: Discount | null) => void;
  setOrderDiscount: (discount: Discount | null) => void;
  clear: () => void;
  /** 会計を確定したあと（保存側のカートは確定と同じトランザクションで空になっている） */
  resetAfterCheckout: () => void;
}

// 書き込みは順番どおりに行う（前の書き込みを追い越さないように）
let writeQueue: Promise<void> = Promise.resolve();
// 読み戻しの途中でタップされたら、読んだ内容で上書きしないための番号
let version = 0;

function persist(cart: Cart | null): void {
  version++;
  writeQueue = writeQueue
    .then(() => (cart ? saveCart(cart) : clearSavedCart()))
    .catch((e: unknown) => console.error('カートを保存できませんでした', e));
}

export const useCartStore = create<CartState>((set, get) => {
  /** カートを変えて保存する。行がなくなったらカートごと消す */
  const update = (fn: (cart: Cart) => Cart) => {
    const current = get().cart;
    if (!current) return;
    const next = { ...fn(current), updatedAt: Date.now() };
    const cart = next.lines.length > 0 ? next : null;
    set({ cart });
    persist(cart);
  };

  return {
    loaded: false,
    cart: null,

    hydrate: async () => {
      const startVersion = version;
      await writeQueue;
      const saved = await getCart();
      if (version === startVersion) set({ cart: saved, loaded: true });
      else set({ loaded: true });
    },

    add: (eventId, productId, unitPrice) => {
      const current = get().cart;
      const base: Cart =
        current && current.eventId === eventId
          ? current
          : { eventId, lines: [], orderDiscount: null, updatedAt: 0 };
      const newLine: CartLine =
        unitPrice === undefined
          ? { productId, qty: 1, discount: null }
          : { productId, unitPrice, qty: 1, discount: null };
      const key = cartLineKey(newLine);
      const exists = base.lines.some((l) => cartLineKey(l) === key);
      const cart: Cart = {
        ...base,
        lines: exists
          ? base.lines.map((l) => (cartLineKey(l) === key ? { ...l, qty: l.qty + 1 } : l))
          : [...base.lines, newLine],
        updatedAt: Date.now(),
      };
      set({ cart });
      persist(cart);
    },

    setQty: (key, qty) =>
      update((c) => ({
        ...c,
        lines:
          qty <= 0
            ? c.lines.filter((l) => cartLineKey(l) !== key)
            : c.lines.map((l) => (cartLineKey(l) === key ? { ...l, qty } : l)),
      })),

    setUnitPrice: (key, unitPrice) =>
      update((c) => {
        const line = c.lines.find((l) => cartLineKey(l) === key);
        if (!line) return c;
        const base = { productId: line.productId, qty: line.qty, discount: line.discount };
        const changed: CartLine = unitPrice === undefined ? base : { ...base, unitPrice };
        const newKey = cartLineKey(changed);
        if (newKey === key) return c;
        const target = c.lines.find((l) => cartLineKey(l) === newKey);
        return {
          ...c,
          lines: target
            ? c.lines
                .filter((l) => l !== line)
                .map((l) => (l === target ? { ...l, qty: l.qty + line.qty } : l))
            : c.lines.map((l) => (l === line ? changed : l)),
        };
      }),

    removeLine: (key) =>
      update((c) => ({ ...c, lines: c.lines.filter((l) => cartLineKey(l) !== key) })),

    setLineDiscount: (key, discount) =>
      update((c) => ({
        ...c,
        lines: c.lines.map((l) => (cartLineKey(l) === key ? { ...l, discount } : l)),
      })),

    setOrderDiscount: (orderDiscount) => update((c) => ({ ...c, orderDiscount })),

    clear: () => {
      set({ cart: null });
      persist(null);
    },

    resetAfterCheckout: () => {
      version++;
      set({ cart: null });
    },
  };
});

/** カートの点数（数量の合計） */
export function cartQty(cart: Cart | null): number {
  return cart?.lines.reduce((s, l) => s + l.qty, 0) ?? 0;
}

/** カートの書き込みが終わるまで待つ（テストと、確定の前に使う） */
export function cartSaved(): Promise<void> {
  return writeQueue;
}
