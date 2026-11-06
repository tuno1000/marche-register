import { useId, type ReactNode } from 'react';
import styles from './Switch.module.css';

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** ラベルの下に出す説明 */
  description?: ReactNode;
}

/** ON / OFF の切り替え（1 行） */
export function Switch({ label, checked, onChange, description }: Props) {
  const labelId = useId();
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {description && <span className={styles.description}>{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        className={`${styles.switch} ${checked ? styles.on : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} />
        <span className={styles.state} aria-hidden="true">
          {checked ? 'ON' : 'OFF'}
        </span>
      </button>
    </div>
  );
}
