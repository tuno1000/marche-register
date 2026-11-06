import styles from './Segmented.module.css';

interface Props<T extends string | number> {
  /** 読み上げ用の名前 */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** 2〜3 個から 1 つを選ぶボタン（税率、テーマなど） */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`${styles.option} ${o.value === value ? styles.selected : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
