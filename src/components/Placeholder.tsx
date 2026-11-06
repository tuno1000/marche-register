import styles from './Placeholder.module.css';

interface Props {
  /** 画面設計の ID と名前（例：'S-03 取引履歴'） */
  screen: string;
  /** 作る予定の段階（例：'M4'） */
  milestone: string;
}

/** まだ作っていない画面の仮の表示 */
export function Placeholder({ screen, milestone }: Props) {
  return (
    <div className={styles.root}>
      <p className={styles.name}>{screen}</p>
      <p className={styles.note}>この画面は {milestone} で作ります</p>
    </div>
  );
}
