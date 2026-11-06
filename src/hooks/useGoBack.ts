import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * 前の画面に戻る関数。URL を直接開いたときなど、アプリ内で戻る先がない場合は fallback へ移る
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (location.key === 'default') {
      void navigate(fallback, { replace: true });
    } else {
      void navigate(-1);
    }
  }, [fallback, location.key, navigate]);
}
