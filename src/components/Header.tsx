import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import styles from './Header.module.css';

interface Props {
  title: ReactNode;
  /** 指定すると「◀ 戻る」を表示する。アプリ内の履歴がないときは、このパスへ移る */
  backTo?: string;
  /** 右端に置くボタンなど */
  right?: ReactNode;
}

/** 画面上部のヘッダー（02-画面設計 1.3） */
export function Header({ title, backTo, right }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    // URL を直接開いたときなど、アプリ内で戻る先がない場合は backTo へ
    if (location.key === 'default' && backTo) {
      navigate(backTo, { replace: true });
    } else {
      navigate(-1);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.side}>
        {backTo !== undefined && (
          <button type="button" className={styles.back} onClick={goBack}>
            ◀ 戻る
          </button>
        )}
      </div>
      <h1 className={styles.title}>{title}</h1>
      <div className={`${styles.side} ${styles.right}`}>{right}</div>
    </header>
  );
}
