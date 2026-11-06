import { useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { Segmented } from '../../components/Segmented';
import ui from '../../components/ui.module.css';
import { discountAmount, isValidPercent, percentDiscountAmount } from '../../domain/discount';
import type { Discount, DiscountPreset, Rounding, Yen } from '../../domain/types';
import { digitsOnly, formatYen, ROUNDING_LABELS } from '../../lib/format';
import styles from './DiscountSheet.module.css';

export interface DiscountTarget {
  /** 例：「ハーブティー ×1」「会計全体」 */
  label: string;
  /** 明細 / 会計全体 */
  scope: 'line' | 'order';
  /** 対象金額 */
  base: Yen;
  current: Discount | null;
}

interface Props {
  target: DiscountTarget | null;
  presets: DiscountPreset[];
  defaultRounding: Rounding;
  onApply: (discount: Discount | null) => void;
  onClose: () => void;
}

const KIND_OPTIONS = [
  { value: 'yen', label: '円' },
  { value: 'percent', label: '%' },
] as const;
const ROUNDINGS: Rounding[] = ['floor', 'ceil', 'round10'];

/** S-01b 値引き（ボトムシート） */
export function DiscountSheet({ target, presets, defaultRounding, onApply, onClose }: Props) {
  return (
    <BottomSheet open={target !== null} title={`値引き：${target?.label ?? ''}`} onClose={onClose}>
      {target && (
        <DiscountForm
          // 開くたびに入力を作り直す
          key={`${target.label}-${target.scope}`}
          target={target}
          presets={presets}
          defaultRounding={defaultRounding}
          onApply={onApply}
        />
      )}
    </BottomSheet>
  );
}

function DiscountForm({
  target,
  presets,
  defaultRounding,
  onApply,
}: {
  target: DiscountTarget;
  presets: DiscountPreset[];
  defaultRounding: Rounding;
  onApply: (discount: Discount | null) => void;
}) {
  const { current, base } = target;
  // すでに値引きがあれば、その内容を入れておく
  const [kind, setKind] = useState<Discount['kind']>(current?.kind ?? 'yen');
  const [text, setText] = useState(current ? String(current.value) : '');
  const [rounding, setRounding] = useState<Rounding>(
    current?.kind === 'percent' ? current.rounding : defaultRounding,
  );

  // 対象（明細 / 会計全体）で使える定型ボタンだけ
  const usablePresets = presets.filter((p) => p.scope === 'both' || p.scope === target.scope);
  const value = text === '' ? 0 : Number(text);

  let error: string | null = null;
  if (text !== '' && kind === 'percent' && !isValidPercent(value)) {
    error = '% は 1〜100 で入力してください';
  } else if (text !== '' && kind === 'yen' && value > base) {
    error = `対象金額（${formatYen(base)}）より大きい値引きはできません`;
  }
  const canApply = value > 0 && error === null;

  const discount: Discount | null = !canApply
    ? null
    : kind === 'yen'
      ? { kind: 'yen', value }
      : { kind: 'percent', value, rounding };

  return (
    <div className={styles.form}>
      <p className={styles.base}>
        対象金額 <strong>{formatYen(base)}</strong>
      </p>

      {usablePresets.length > 0 && (
        <section>
          <h3 className={ui.sectionTitle}>定型</h3>
          <div className={styles.presets}>
            {usablePresets.map((p) => (
              <button
                key={p.id}
                type="button"
                className={ui.button}
                onClick={() => {
                  setKind(p.kind);
                  setText(String(p.value));
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className={ui.sectionTitle}>自由入力</h3>
        <div className={styles.freeInput}>
          <div className={styles.kind}>
            <Segmented
              label="値引きの種類"
              options={KIND_OPTIONS}
              value={kind}
              onChange={setKind}
            />
          </div>
          <input
            className={ui.input}
            value={text}
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={kind === 'yen' ? '値引き額（円）' : '値引き率（%）'}
            aria-invalid={error !== null}
            onChange={(e) => setText(digitsOnly(e.target.value).replace(/^0+(?=\d)/, ''))}
          />
        </div>
        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
      </section>

      {kind === 'percent' && canApply && (
        <section>
          <h3 className={ui.sectionTitle}>端数処理</h3>
          <div className={styles.roundings} role="radiogroup" aria-label="端数処理">
            {ROUNDINGS.map((r) => {
              const amount = percentDiscountAmount(base, value, r);
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={rounding === r}
                  className={`${styles.rounding} ${rounding === r ? styles.selected : ''}`}
                  onClick={() => setRounding(r)}
                >
                  <span className={styles.radioMark} aria-hidden="true">
                    {rounding === r ? '◉' : '○'}
                  </span>
                  <span className={styles.roundingName}>{ROUNDING_LABELS[r]}</span>
                  <span>
                    -{formatYen(amount)} → {formatYen(base - amount)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {kind === 'yen' && canApply && discount && (
        <p className={styles.preview}>
          -{formatYen(discountAmount(base, discount))} →{' '}
          {formatYen(base - discountAmount(base, discount))}
        </p>
      )}

      <div className={styles.buttons}>
        <button
          type="button"
          className={`${ui.button} ${ui.large}`}
          onClick={() => onApply(null)}
          disabled={current === null}
        >
          値引きを外す
        </button>
        <button
          type="button"
          className={`${ui.button} ${ui.primary} ${ui.large}`}
          onClick={() => onApply(discount)}
          disabled={!canApply}
        >
          適用
        </button>
      </div>
    </div>
  );
}
