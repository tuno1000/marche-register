import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { Header } from '../../components/Header';
import ui from '../../components/ui.module.css';
import { listCategories } from '../../db/repositories/categories';
import { listProducts } from '../../db/repositories/products';
import { checkout } from '../../db/repositories/transactions';
import { isAppError } from '../../domain/errors';
import { useWakeLock } from '../../hooks/useWakeLock';
import { formatYen } from '../../lib/format';
import { cartSaved, useCartStore } from './cartStore';
import { buildCartView } from './cartView';
import styles from './TenderScreen.module.css';

/** 金額ボタン：押すたびに足していく（02-画面設計 D-3） */
const QUICK_AMOUNTS = [10000, 5000, 1000, 500, 100] as const;
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '00'] as const;
/** お預かりの上限（桁を付け足しすぎないように） */
const MAX_TENDER = 9_999_999;

/** S-01c お預かり */
export function TenderScreen() {
  useWakeLock();
  const { cart, loaded, resetAfterCheckout } = useCartStore();
  const data = useLiveQuery(async () => ({
    products: await listProducts(),
    categories: await listCategories(),
  }));
  const view = useMemo(
    () =>
      buildCartView(
        cart,
        new Map(data?.products.map((p) => [p.id, p])),
        new Map(data?.categories.map((c) => [c.id, c])),
      ),
    [cart, data],
  );

  const [tendered, setTendered] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 確定した取引。カートを空にしたあとも、会計画面ではなくレシートへ進むため */
  const [doneTxId, setDoneTxId] = useState<string | null>(null);
  // 連打しても 1 回だけ確定する（state の更新を待たずに止める）
  const submitting = useRef(false);

  // 戻るボタンでお預かり画面に戻らないよう、置き換える（04-技術設計 3 章）
  if (doneTxId) return <Navigate to={`/receipt/${doneTxId}`} replace />;
  if (!loaded || !data) return <Header title="お預かり" backTo="/" />;
  // カートが空なら会計画面へ（会計を確定したあとに URL を開き直したときなど）
  if (!cart || view.lines.length === 0) return <Navigate to="/" replace />;

  const total = view.total;
  const shortage = total - tendered;

  const change = (next: number) => {
    setError(null);
    setTendered(Math.min(next, MAX_TENDER));
  };

  const pressKey = (key: (typeof KEYS)[number]) => {
    if (key === 'C') return change(0);
    const next = Number(`${tendered === 0 ? '' : tendered}${key}`);
    if (next <= MAX_TENDER) change(next);
  };

  const confirm = async () => {
    if (submitting.current || shortage > 0) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await cartSaved();
      const tx = await checkout({
        eventId: cart.eventId,
        lines: cart.lines,
        orderDiscount: cart.orderDiscount,
        tendered,
      });
      setDoneTxId(tx.id);
      resetAfterCheckout();
    } catch (e) {
      submitting.current = false;
      setBusy(false);
      setError(
        isAppError(e) ? e.message : '保存できませんでした。もう一度［確定］を押してください',
      );
    }
  };

  return (
    <>
      <Header title="お預かり" backTo="/" />
      <div className={styles.body}>
        <dl className={styles.amounts}>
          <div className={styles.amountRow}>
            <dt>合計</dt>
            <dd className={styles.total}>{formatYen(total)}</dd>
          </div>
          <div className={styles.amountRow}>
            <dt>お預かり</dt>
            <dd className={styles.tendered} aria-label="お預かり額">
              {formatYen(tendered)}
            </dd>
          </div>
          <div className={styles.amountRow}>
            <dt>お釣り</dt>
            {shortage > 0 ? (
              <dd className={`${styles.change} ${styles.short}`} aria-label="お釣り">
                あと {formatYen(shortage)}
              </dd>
            ) : (
              <dd className={styles.change} aria-label="お釣り">
                {formatYen(tendered - total)}
              </dd>
            )}
          </div>
        </dl>

        <div className={styles.quick}>
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              className={`${ui.button} ${styles.key}`}
              onClick={() => change(tendered + amount)}
            >
              ＋{amount.toLocaleString('ja-JP')}
            </button>
          ))}
          <button
            type="button"
            className={`${ui.button} ${styles.key}`}
            onClick={() => change(total)}
          >
            ぴったり
          </button>
        </div>

        <div className={styles.keypad}>
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`${ui.button} ${styles.key} ${key === 'C' ? styles.clear : ''}`}
              onClick={() => pressKey(key)}
              aria-label={key === 'C' ? 'クリア' : key}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className={ui.footer}>
        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className={`${ui.button} ${ui.primary} ${ui.large}`}
          onClick={() => void confirm()}
          disabled={shortage > 0 || busy}
        >
          {busy ? '保存中…' : '確定'}
        </button>
      </div>
    </>
  );
}
