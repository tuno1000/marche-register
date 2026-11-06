import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { usePwaStore } from '../../app/pwaStore';
import { Header } from '../../components/Header';
import ui from '../../components/ui.module.css';
import { getKv, setKv } from '../../db/kv';
import { useGoBack } from '../../hooks/useGoBack';
import { isAndroid, isIos, isStandalone } from '../../lib/device';
import styles from './InstallScreen.module.css';

/** S-08 インストール案内（要件定義 F-12） */
export function InstallScreen() {
  const navigate = useNavigate();
  const goBack = useGoBack('/');
  const { installPrompt, installed } = usePwaStore();
  const dismissed = useLiveQuery(async () => (await getKv('installWarningDismissed')) ?? false);
  const device = isIos() ? 'ios' : isAndroid() ? 'android' : 'other';

  const continueInBrowser = async () => {
    if (dismissed) {
      // ヘッダーの下の警告から開いたときは、元の画面に戻る
      goBack();
      return;
    }
    await setKv('installWarningDismissed', true);
    void navigate('/', { replace: true });
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    // 一度使った案内は使い回せない
    usePwaStore.setState({ installPrompt: null, installed: outcome === 'accepted' });
  };

  return (
    <>
      <Header title="マルシェレジ" backTo={dismissed ? '/' : undefined} />
      <div className={`${ui.body} ${styles.body}`}>
        <img
          className={styles.icon}
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt=""
          width={88}
          height={88}
        />
        {isStandalone() ? (
          <p className={styles.lead}>ホーム画面から起動しています。このまま使えます。</p>
        ) : installed ? (
          <p className={styles.lead} role="status">
            ホーム画面に追加しました。
            <br />
            ブラウザを閉じて、ホーム画面の「マルシェレジ」のアイコンから起動してください。
          </p>
        ) : (
          <>
            <h2 className={styles.lead}>
              ホーム画面に追加して
              <wbr />
              使ってください
            </h2>

            {installPrompt ? (
              <button
                type="button"
                className={`${ui.button} ${ui.primary} ${ui.large} ${ui.block}`}
                onClick={() => void install()}
              >
                インストール
              </button>
            ) : device === 'ios' ? (
              <IosSteps />
            ) : device === 'android' ? (
              <AndroidSteps />
            ) : (
              <p className={ui.hint}>
                スマホのブラウザでこのページを開き、ホーム画面に追加してください。
              </p>
            )}

            <p className={styles.warning}>
              ⚠ ブラウザで開いたまま使うと、ホーム画面に追加したアプリとはデータが別になります。
            </p>
          </>
        )}

        <button type="button" className={styles.continue} onClick={() => void continueInBrowser()}>
          このまま使う
        </button>
      </div>
    </>
  );
}

/** iPhone の手順（Safari の共有ボタン →「ホーム画面に追加」） */
function IosSteps() {
  return (
    <ol className={styles.steps} aria-label="iPhone での手順">
      <li>
        <span className={styles.stepText}>
          画面の下の <ShareIcon /> <strong>共有</strong> をタップ
          <span className={styles.note}>
            見当たらないときは、［…］をタップしてから共有を選びます
          </span>
        </span>
      </li>
      <li>
        <span className={styles.stepText}>
          <AddIcon /> <strong>ホーム画面に追加</strong> を選ぶ
          <span className={styles.note}>見当たらないときは、一覧を下へスクロールします</span>
        </span>
      </li>
      <li>
        <span className={styles.stepText}>
          ホーム画面の <strong>マルシェレジ</strong> のアイコンから起動
        </span>
      </li>
    </ol>
  );
}

/** Android の手順（インストールボタンが使えないブラウザ） */
function AndroidSteps() {
  return (
    <ol className={styles.steps} aria-label="Android での手順">
      <li>
        <span className={styles.stepText}>
          右上の <strong>⋮</strong>（メニュー）をタップ
        </span>
      </li>
      <li>
        <span className={styles.stepText}>
          <strong>ホーム画面に追加</strong> または <strong>アプリをインストール</strong> を選ぶ
        </span>
      </li>
      <li>
        <span className={styles.stepText}>
          ホーム画面の <strong>マルシェレジ</strong> のアイコンから起動
        </span>
      </li>
    </ol>
  );
}

/** Safari の共有ボタンの形（四角から上向きの矢印） */
function ShareIcon() {
  return (
    <svg className={styles.inlineIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3v12 M7.5 7.5 12 3l4.5 4.5 M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 「ホーム画面に追加」の形（四角の中に ＋） */
function AddIcon() {
  return (
    <svg className={styles.inlineIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z M12 8v8 M8 12h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
