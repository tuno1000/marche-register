import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBackGuard } from '../app/BackGuard';
import styles from './ConfirmDialog.module.css';
import ui from './ui.module.css';

interface Props {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** 削除など、元に戻せない操作のとき */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * false にすると、戻るボタンを横取りしない。
   * 「変更を破棄しますか？」のように、止めた画面移動の確認に使うとき
   */
  guardBack?: boolean;
}

/** 確認ダイアログ（02-画面設計 1.2） */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'キャンセル',
  danger,
  onConfirm,
  onCancel,
  guardBack = true,
}: Props) {
  const titleId = useId();
  const cancelButton = useRef<HTMLButtonElement>(null);

  useBackGuard(open && guardBack, (held) => {
    held.reset();
    onCancel();
  });

  useEffect(() => {
    if (open) cancelButton.current?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {message && <div className={styles.message}>{message}</div>}
        <div className={styles.buttons}>
          <button ref={cancelButton} type="button" className={ui.button} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${ui.button} ${danger ? ui.dangerFilled : ui.primary}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
