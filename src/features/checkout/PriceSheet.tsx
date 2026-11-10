import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import ui from '../../components/ui.module.css';
import type { Product, Yen } from '../../domain/types';
import { digitsOnly, formatYen } from '../../lib/format';
import styles from './PriceSheet.module.css';

/** 入力できる金額の上限 */
export const PRICE_MAX = 9_999_999;

export interface PriceTarget {
  product: Product;
  /**
   * add：価格を空にした商品をタップしたとき（入力した金額でカートに追加する）
   * change：カートの行の金額を変えるとき
   */
  mode: 'add' | 'change';
  /** カートの行のキー（change のとき） */
  lineKey?: string;
  /** 入力欄に最初に入れておく金額 */
  initial: Yen | null;
}

interface Props {
  target: PriceTarget | null;
  onSubmit: (target: PriceTarget, unitPrice: Yen) => void;
  onClose: () => void;
}

/**
 * S-01d 金額入力（ボトムシート）。
 * 価格を空にした商品をタップしたときと、カートの行のメニューで［金額を変える］を選んだときに出す
 */
export function PriceSheet({ target, onSubmit, onClose }: Props) {
  return (
    <BottomSheet
      open={target !== null}
      title={`金額：${target?.product.name ?? ''}`}
      onClose={onClose}
    >
      {target && (
        <PriceForm
          // 開くたびに入力を作り直す
          key={`${target.mode}-${target.lineKey ?? target.product.id}`}
          target={target}
          onSubmit={(unitPrice) => onSubmit(target, unitPrice)}
        />
      )}
    </BottomSheet>
  );
}

function PriceForm({
  target,
  onSubmit,
}: {
  target: PriceTarget;
  onSubmit: (unitPrice: Yen) => void;
}) {
  const [text, setText] = useState(target.initial === null ? '' : String(target.initial));
  const input = useRef<HTMLInputElement>(null);

  // シートがパネルにフォーカスしたあとで、入力欄にフォーカスする（すぐ打てるように）。
  // 金額が入っていれば全体を選び、打てば置き換わるようにする
  useEffect(() => {
    const id = setTimeout(() => {
      input.current?.focus();
      input.current?.select();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const value = text === '' ? null : Number(text);
  const error =
    value !== null && value > PRICE_MAX ? `${formatYen(PRICE_MAX)} までで入力してください` : null;
  const canSubmit = value !== null && error === null;
  const { product, mode } = target;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(value);
      }}
    >
      {mode === 'change' && product.price !== null && (
        <p className={styles.note}>登録した価格 {formatYen(product.price)}</p>
      )}
      <div className={styles.inputRow}>
        <input
          ref={input}
          className={ui.input}
          value={text}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-label="金額（税込）"
          aria-invalid={error !== null}
          onChange={(e) => setText(digitsOnly(e.target.value).replace(/^0+(?=\d)/, ''))}
        />
        <span>円</span>
      </div>
      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className={`${ui.button} ${ui.primary} ${ui.large}`}
        disabled={!canSubmit}
      >
        {mode === 'add' ? 'カートに追加' : '金額を変える'}
      </button>
    </form>
  );
}
