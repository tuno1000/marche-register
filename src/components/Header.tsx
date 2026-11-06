import type { ReactNode } from 'react';
import { useGoBack } from '../hooks/useGoBack';
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
  const goBack = useGoBack(backTo ?? '/');

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

interface ActionProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

/** ヘッダーの右に置くボタン（［保存］［並べ替え］など） */
export function HeaderAction({ children, onClick, disabled }: ActionProps) {
  return (
    <button type="button" className={styles.action} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
