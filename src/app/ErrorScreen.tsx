import { useRouteError } from 'react-router';
import styles from './ErrorScreen.module.css';

/** 予期しないエラーのときの画面（04-技術設計 8 章） */
export function ErrorScreen() {
  const error = useRouteError();
  console.error(error);

  return (
    <div className={styles.root} role="alert">
      <p className={styles.title}>問題が発生しました</p>
      <p className={styles.note}>カートの中身は保存されています。</p>
      <button type="button" className={styles.button} onClick={() => window.location.reload()}>
        再読み込み
      </button>
    </div>
  );
}
