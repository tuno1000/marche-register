import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router';
import { Header } from '../../components/Header';
import ui from '../../components/ui.module.css';
import { getTransaction } from '../../db/repositories/transactions';
import { useGoBack } from '../../hooks/useGoBack';
import { useWakeLock } from '../../hooks/useWakeLock';
import { formatYen } from '../../lib/format';
import { PrintButton } from './PrintButton';
import styles from './ReceiptScreen.module.css';
import { ReceiptView } from './ReceiptView';

/** S-02 レシート（会計直後。上部にお釣りを大きく表示する） */
export function ReceiptScreen() {
  useWakeLock();
  const { txId } = useParams();
  const tx = useLiveQuery(
    async () => (txId ? ((await getTransaction(txId)) ?? null) : null),
    [txId],
  );
  // 戻る先は会計画面（お預かり画面は置き換えてあるので戻らない）
  const next = useGoBack('/');

  return (
    <>
      <Header title="レシート" />
      {tx === null && <p className={ui.empty}>取引が見つかりません。</p>}
      {tx && (
        <>
          <div className={styles.change}>
            <span>お釣り</span>
            <strong aria-label="お釣り">{formatYen(tx.change)}</strong>
          </div>
          <div className={ui.body}>
            <ReceiptView tx={tx} />
          </div>
        </>
      )}
      <div className={ui.footer}>
        {tx && <PrintButton />}
        <button type="button" className={`${ui.button} ${ui.primary} ${ui.large}`} onClick={next}>
          次の会計へ
        </button>
      </div>
    </>
  );
}
