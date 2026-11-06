import type { CategoryColor } from '../domain/types';
import styles from './CategoryDot.module.css';

/** カテゴリの色の丸 */
export function CategoryDot({ color, size = 16 }: { color: CategoryColor; size?: number }) {
  return (
    <span
      className={styles.dot}
      style={{ background: `var(--cat-${color})`, width: size, height: size }}
      aria-hidden="true"
    />
  );
}
