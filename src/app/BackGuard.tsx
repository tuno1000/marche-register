import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useBlocker } from 'react-router';

/** 止めた画面移動を、そのまま進めるか、取りやめるか */
export interface HeldNavigation {
  proceed: () => void;
  reset: () => void;
}

interface Entry {
  active: boolean;
  /** true なら、戻る以外の画面移動（タブやリンク）も止める */
  blockAll: boolean;
  onBack: (held: HeldNavigation) => void;
}

interface BackGuardApi {
  register: (entry: { current: Entry }) => () => void;
  /** 次の 1 回の画面移動は止めない（保存したあとに戻るときなど） */
  allowNext: () => void;
}

const BackGuardContext = createContext<BackGuardApi | null>(null);

/**
 * 「戻る」の動きを横取りする仕組み（04-技術設計 3 章）。
 * シートや確認ダイアログは URL を変えずに開き、Android の戻るボタンでは画面を移らずに閉じる。
 * 入力途中の画面では、戻る前に「変更を破棄しますか？」と確かめる。
 *
 * React Router の blocker は 1 つしか使えないので、ここで 1 つだけ持ち、
 * 開いている部品のうち最後に登録したものに知らせる。
 */
export function BackGuardProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Set<{ current: Entry }>());
  const allowOnce = useRef(false);

  const shouldBlock = useCallback(({ historyAction }: { historyAction: string }) => {
    if (allowOnce.current) {
      allowOnce.current = false;
      return false;
    }
    return [...entries.current].some(
      (e) => e.current.active && (e.current.blockAll || historyAction === 'POP'),
    );
  }, []);

  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const top = [...entries.current].reverse().find((e) => e.current.active);
    if (top) top.current.onBack({ proceed: blocker.proceed, reset: blocker.reset });
    else blocker.proceed();
  }, [blocker]);

  const api = useMemo<BackGuardApi>(
    () => ({
      register: (entry) => {
        entries.current.add(entry);
        return () => {
          entries.current.delete(entry);
        };
      },
      allowNext: () => {
        allowOnce.current = true;
      },
    }),
    [],
  );

  return <BackGuardContext.Provider value={api}>{children}</BackGuardContext.Provider>;
}

function useBackGuardApi(): BackGuardApi {
  const api = useContext(BackGuardContext);
  if (!api) throw new Error('BackGuardProvider の中で使ってください');
  return api;
}

/**
 * active の間、戻るボタンで onBack を呼ぶ。onBack は held.reset()（とどまる）か
 * held.proceed()（そのまま戻る）のどちらかを必ず呼ぶ。
 */
export function useBackGuard(
  active: boolean,
  onBack: (held: HeldNavigation) => void,
  options: { blockAll?: boolean } = {},
): void {
  const api = useBackGuardApi();
  const entry = useRef<Entry>({ active, blockAll: !!options.blockAll, onBack });

  useEffect(() => {
    entry.current = { active, blockAll: !!options.blockAll, onBack };
  });

  useEffect(() => api.register(entry), [api]);
}

/** 次の 1 回の画面移動を止めないようにする関数 */
export function useAllowNextNavigation(): () => void {
  return useBackGuardApi().allowNext;
}
