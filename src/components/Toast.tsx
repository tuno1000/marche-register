import { useEffect } from 'react';
import { create } from 'zustand';
import styles from './Toast.module.css';

interface ToastState {
  message: string | null;
  /** 同じ文言を続けて出したときも、表示時間を延ばすための番号 */
  seq: number;
  show: (message: string) => void;
  hide: () => void;
}

const useToastStore = create<ToastState>((set) => ({
  message: null,
  seq: 0,
  show: (message) => set((s) => ({ message, seq: s.seq + 1 })),
  hide: () => set({ message: null }),
}));

/** 画面下部に短いメッセージを出す（02-画面設計 1.2） */
export function showToast(message: string): void {
  useToastStore.getState().show(message);
}

export function hideToast(): void {
  useToastStore.getState().hide();
}

const DURATION_MS = 2500;

export function Toaster() {
  const { message, seq, hide } = useToastStore();

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(hide, DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, seq, hide]);

  return (
    <div className={styles.area} role="status" aria-live="polite">
      {message !== null && <div className={styles.toast}>{message}</div>}
    </div>
  );
}
