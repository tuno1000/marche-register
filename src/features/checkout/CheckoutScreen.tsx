import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Header } from '../../components/Header';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import { getCurrentEventId } from '../../db/kv';
import { listCategories } from '../../db/repositories/categories';
import { getEvent, listEventStocks, soldQtyByProduct } from '../../db/repositories/events';
import { listProducts } from '../../db/repositories/products';
import { cartLineKey } from '../../domain/cartLine';
import type { Category, Discount, Id, Product, Yen } from '../../domain/types';
import { useProductImageUrl } from '../../hooks/useProductImageUrl';
import { useSettings } from '../../hooks/useSettings';
import { useWakeLock } from '../../hooks/useWakeLock';
import { discountLabel, formatShortDate, formatYen } from '../../lib/format';
import { useCartStore } from './cartStore';
import { buildCartView, remainingStock, type CartView, type CartViewLine } from './cartView';
import styles from './CheckoutScreen.module.css';
import { DiscountSheet, type DiscountTarget } from './DiscountSheet';
import { PriceSheet, type PriceTarget } from './PriceSheet';

/** 最後に選んだカテゴリのタブ（ほかの画面から戻っても同じタブにする） */
let lastCategoryId: Id | null = null;

/** S-01 会計（下半分は S-01a カート欄） */
export function CheckoutScreen() {
  useWakeLock();
  const navigate = useNavigate();

  const data = useLiveQuery(async () => {
    const eventId = await getCurrentEventId();
    const event = eventId ? await getEvent(eventId) : undefined;
    const [categories, products] = await Promise.all([listCategories(), listProducts()]);
    return {
      event: event ?? null,
      categories,
      products,
      brought: new Map(
        event ? (await listEventStocks(event.id)).map((s) => [s.productId, s.broughtQty]) : [],
      ),
      sold: event ? await soldQtyByProduct(event.id) : new Map<Id, number>(),
    };
  });
  const settings = useSettings();
  const {
    cart,
    loaded,
    add,
    setQty,
    setUnitPrice,
    removeLine,
    setLineDiscount,
    setOrderDiscount,
    clear,
  } = useCartStore();

  // 会計画面を開いたら、保存されたカートを読み直す（ほかの画面で商品を削除したときなど）
  useEffect(() => {
    void useCartStore.getState().hydrate();
  }, []);

  const event = data?.event ?? null;

  // 別のイベントのカートが残っていたら空にする
  useEffect(() => {
    if (data && loaded && cart && cart.eventId !== event?.id) clear();
  }, [data, loaded, cart, event, clear]);

  const productMap = useMemo(() => new Map(data?.products.map((p) => [p.id, p])), [data]);
  const categoryMap = useMemo(() => new Map(data?.categories.map((c) => [c.id, c])), [data]);
  const view = useMemo(
    () => buildCartView(cart, productMap, categoryMap),
    [cart, productMap, categoryMap],
  );

  const [highlight, setHighlight] = useState<{ key: string; n: number } | null>(null);
  const [menuFor, setMenuFor] = useState<CartViewLine | null>(null);
  const [priceTarget, setPriceTarget] = useState<PriceTarget | null>(null);
  const [discountTarget, setDiscountTarget] = useState<
    (DiscountTarget & { lineKey: string | null }) | null
  >(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const remaining = (p: Product) =>
    data ? remainingStock(p, data.brought, data.sold, cart) : null;

  /** カートに 1 個追加する。unitPrice は価格を空にした商品で入力した単価 */
  const addLine = (p: Product, unitPrice?: Yen) => {
    if (!event) return;
    const left = remaining(p);
    if (left !== null && left <= 0) {
      showToast(`「${p.name}」はこれ以上ありません`);
      return;
    }
    add(event.id, p.id, unitPrice);
    const key = cartLineKey({ productId: p.id, unitPrice });
    setHighlight((h) => ({ key, n: (h?.n ?? 0) + 1 }));
  };

  // 価格を空にした商品は、金額を入力してから追加する
  const tapProduct = (p: Product) => {
    if (p.price !== null) {
      addLine(p);
      return;
    }
    const left = remaining(p);
    if (left !== null && left <= 0) {
      showToast(`「${p.name}」はこれ以上ありません`);
      return;
    }
    setPriceTarget({ product: p, mode: 'add', initial: null });
  };

  const openPriceChange = (line: CartViewLine) => {
    setMenuFor(null);
    setPriceTarget({
      product: line.product,
      mode: 'change',
      lineKey: line.key,
      initial: line.unitPrice,
    });
  };

  const submitPrice = (target: PriceTarget, unitPrice: Yen) => {
    setPriceTarget(null);
    const { product } = target;
    if (target.mode === 'add') {
      addLine(product, unitPrice);
      return;
    }
    // 登録した価格と同じにしたら、入力した単価を外す（登録した価格の行とまとまる）
    const entered = unitPrice === product.price ? undefined : unitPrice;
    setUnitPrice(target.lineKey!, entered);
    const key = cartLineKey({ productId: product.id, unitPrice: entered });
    setHighlight((h) => ({ key, n: (h?.n ?? 0) + 1 }));
  };

  const openLineDiscount = (key: string) => {
    const line = view.lines.find((l) => l.key === key);
    if (!line) return;
    setMenuFor(null);
    setDiscountTarget({
      lineKey: key,
      label: `${lineLabel(line)} ×${line.qty}`,
      scope: 'line',
      base: line.grossAmount,
      current: line.lineDiscount,
    });
  };

  const openOrderDiscount = () =>
    setDiscountTarget({
      lineKey: null,
      label: '会計全体',
      scope: 'order',
      base: view.subtotal,
      current: cart?.orderDiscount ?? null,
    });

  const applyDiscount = (discount: Discount | null) => {
    if (!discountTarget) return;
    if (discountTarget.lineKey) setLineDiscount(discountTarget.lineKey, discount);
    else setOrderDiscount(discount);
    setDiscountTarget(null);
  };

  const header = (
    <Header
      title={
        <Link to="/events" className={styles.eventLink}>
          {event ? `${event.name} ${formatShortDate(event.date)}` : 'イベント未選択'}
          <span aria-hidden="true"> ▼</span>
        </Link>
      }
    />
  );

  if (!data) return header;

  if (!event) {
    return (
      <>
        {header}
        <div className={ui.empty}>
          <p>イベントを選んでください</p>
          <Link to="/events" className={`${ui.button} ${ui.primary}`}>
            イベントを選ぶ
          </Link>
        </div>
      </>
    );
  }

  const onSale = data.products.filter((p) => p.isOnSale);
  if (onSale.length === 0) {
    return (
      <>
        {header}
        <div className={ui.empty}>
          <p>商品を登録してください</p>
          <Link to="/products" className={`${ui.button} ${ui.primary}`}>
            商品を登録
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className={styles.main}>
        <ProductPicker
          categories={data.categories}
          products={onSale}
          remaining={remaining}
          soldOut={(p) =>
            p.tracksStock && (data.brought.get(p.id) ?? 0) - (data.sold.get(p.id) ?? 0) <= 0
          }
          onAdd={tapProduct}
        />
        <CartPane
          view={view}
          highlight={highlight}
          onName={setMenuFor}
          onPlus={(line) => addLine(line.product, line.enteredPrice)}
          onMinus={(line) => setQty(line.key, line.qty - 1)}
          onClear={() => setConfirmClear(true)}
          onOrderDiscount={openOrderDiscount}
          onTender={() => void navigate('/tender')}
        />
      </div>

      <BottomSheet
        open={menuFor !== null}
        title={menuFor ? lineLabel(menuFor) : ''}
        onClose={() => setMenuFor(null)}
      >
        {menuFor && (
          <div className={styles.menu}>
            <button
              type="button"
              className={`${ui.button} ${ui.large}`}
              onClick={() => openPriceChange(menuFor)}
            >
              金額を変える
            </button>
            <button
              type="button"
              className={`${ui.button} ${ui.large}`}
              onClick={() => openLineDiscount(menuFor.key)}
            >
              値引き
            </button>
            <button
              type="button"
              className={`${ui.button} ${ui.danger} ${ui.large}`}
              onClick={() => {
                removeLine(menuFor.key);
                setMenuFor(null);
              }}
            >
              カートから削除
            </button>
          </div>
        )}
      </BottomSheet>

      <PriceSheet
        target={priceTarget}
        onSubmit={submitPrice}
        onClose={() => setPriceTarget(null)}
      />

      <DiscountSheet
        target={discountTarget}
        presets={settings?.discountPresets ?? []}
        defaultRounding={settings?.defaultRounding ?? 'floor'}
        onApply={applyDiscount}
        onClose={() => setDiscountTarget(null)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="カートを空にしますか？"
        confirmLabel="空にする"
        danger
        onConfirm={() => {
          clear();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}

/** カテゴリのタブと商品ボタン */
function ProductPicker({
  categories,
  products,
  remaining,
  soldOut,
  onAdd,
}: {
  categories: Category[];
  products: Product[];
  remaining: (p: Product) => number | null;
  soldOut: (p: Product) => boolean;
  onAdd: (p: Product) => void;
}) {
  // 販売中の商品があるカテゴリだけタブにする
  const tabs = categories.filter((c) => products.some((p) => p.categoryId === c.id));
  const [selected, setSelected] = useState<Id | null>(lastCategoryId);
  const active = tabs.find((c) => c.id === selected) ?? tabs[0];
  const items = products
    .filter((p) => p.categoryId === active?.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="カテゴリ">
        {tabs.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === active?.id}
            className={styles.tab}
            style={{ '--tab-color': `var(--cat-${c.color})` } as CSSProperties}
            onClick={() => {
              lastCategoryId = c.id;
              setSelected(c.id);
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className={styles.products} role="tabpanel" aria-label={active?.name}>
        <div className={styles.grid}>
          {items.map((p) => (
            <ProductButton
              key={p.id}
              product={p}
              color={active?.color ?? 'c12'}
              remaining={remaining(p)}
              soldOut={soldOut(p)}
              onAdd={() => onAdd(p)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function ProductButton({
  product,
  color,
  remaining,
  soldOut,
  onAdd,
}: {
  product: Product;
  color: Category['color'];
  remaining: number | null;
  soldOut: boolean;
  onAdd: () => void;
}) {
  const imageUrl = useProductImageUrl(product);
  const [flash, setFlash] = useState(0);

  return (
    <button
      type="button"
      className={styles.productButton}
      disabled={soldOut}
      onClick={() => {
        setFlash((n) => n + 1);
        onAdd();
      }}
    >
      {flash > 0 && <span key={flash} className={styles.flash} aria-hidden="true" />}
      {imageUrl ? (
        <img className={styles.productImage} src={imageUrl} alt="" draggable={false} />
      ) : (
        // 画像がない商品は、カテゴリの色に商品名の先頭の文字
        <span
          className={styles.productImage}
          style={{ background: `var(--cat-${color})` }}
          aria-hidden="true"
        >
          {[...product.name][0]}
        </span>
      )}
      <span className={styles.productName}>{product.name}</span>
      <span className={styles.productPrice}>
        {product.price === null ? '金額入力' : formatYen(product.price)}
      </span>
      {soldOut ? (
        <span className={styles.soldOut}>売切</span>
      ) : (
        remaining !== null && <span className={styles.remaining}>残 {Math.max(0, remaining)}</span>
      )}
    </button>
  );
}

/** S-01a カート欄 */
function CartPane({
  view,
  highlight,
  onName,
  onPlus,
  onMinus,
  onClear,
  onOrderDiscount,
  onTender,
}: {
  view: CartView;
  highlight: { key: string; n: number } | null;
  onName: (line: CartViewLine) => void;
  onPlus: (line: CartViewLine) => void;
  onMinus: (line: CartViewLine) => void;
  onClear: () => void;
  onOrderDiscount: () => void;
  onTender: () => void;
}) {
  const rows = useRef(new Map<string, HTMLLIElement>());
  const empty = view.lines.length === 0;

  // 追加した行が見えるようにスクロールする
  useEffect(() => {
    if (highlight) rows.current.get(highlight.key)?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight]);

  return (
    <section className={styles.cart} aria-label="カート">
      <ul className={styles.lines}>
        {empty && <li className={styles.cartEmpty}>商品をタップして追加</li>}
        {view.lines.map((line) => (
          <li
            key={line.key}
            className={styles.line}
            ref={(el) => {
              if (el) rows.current.set(line.key, el);
              else rows.current.delete(line.key);
            }}
          >
            {highlight?.key === line.key && (
              <span key={highlight.n} className={styles.flash} aria-hidden="true" />
            )}
            <div className={styles.lineMain}>
              <button
                type="button"
                className={styles.lineName}
                onClick={() => onName(line)}
                aria-label={`${lineLabel(line)}のメニュー`}
              >
                {line.productName}
                {line.enteredPrice !== undefined && (
                  <span className={styles.enteredPrice}>@{formatYen(line.enteredPrice)}</span>
                )}
                {line.taxRate === 8 && <span aria-label="軽減税率">※</span>}
              </button>
              <div className={styles.qty}>
                <button
                  type="button"
                  className={styles.qtyButton}
                  onClick={() => onMinus(line)}
                  aria-label={`${lineLabel(line)}を 1 減らす`}
                >
                  －
                </button>
                <span className={styles.qtyValue} aria-label={`${lineLabel(line)}の数量`}>
                  {line.qty}
                </span>
                <button
                  type="button"
                  className={styles.qtyButton}
                  onClick={() => onPlus(line)}
                  aria-label={`${lineLabel(line)}を 1 増やす`}
                >
                  ＋
                </button>
              </div>
              <span className={styles.amount}>{formatYen(line.grossAmount)}</span>
            </div>
            {line.lineDiscount && (
              <div className={styles.discountRow}>
                <span>{discountLabel(line.lineDiscount)}</span>
                <span>-{formatYen(line.lineDiscountAmount)}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.summary}>
        {view.orderDiscountAmount > 0 && (
          <div className={styles.discountRow}>
            <span>
              {view.orderDiscount ? discountLabel(view.orderDiscount, '全体値引き') : '全体値引き'}
            </span>
            <span>-{formatYen(view.orderDiscountAmount)}</span>
          </div>
        )}
        <div className={styles.totalRow}>
          <span className={styles.qtyCount}>
            {view.qty}点
            {!empty && (
              <button type="button" className={styles.clearButton} onClick={onClear}>
                全クリア
              </button>
            )}
          </span>
          <span>
            合計 <strong className={styles.total}>{formatYen(view.total)}</strong>
          </span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${ui.button} ${ui.large}`}
            onClick={onOrderDiscount}
            disabled={empty}
          >
            値引き
          </button>
          <button
            type="button"
            className={`${ui.button} ${ui.primary} ${ui.large}`}
            onClick={onTender}
            disabled={empty}
          >
            お預かりへ ▶
          </button>
        </div>
      </div>
    </section>
  );
}

/** 行の名前。金額を入力した（変えた）行は単価も付ける：「その他（¥500）」 */
function lineLabel(line: CartViewLine): string {
  return line.enteredPrice === undefined
    ? line.productName
    : `${line.productName}（${formatYen(line.enteredPrice)}）`;
}
